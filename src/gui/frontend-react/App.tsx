import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Container,
  FormControlLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { browsePath, getCommands, getHistoryValues, runCommandStream } from "./api/client";
import { PathPicker } from "./components/path-picker/PathPicker";
import type { GuiArgDescriptor, GuiCommandDescriptor, GuiRunRequest } from "../shared/types";

function formatResultSummary(result: unknown): string {
  if (typeof result !== "object" || result === null) {
    return String(result);
  }
  const value = result as Record<string, unknown>;
  const summary: Record<string, unknown> = {
    ok: Boolean(value.ok),
    exitCode: value.exitCode ?? null,
  };
  if (Object.prototype.hasOwnProperty.call(value, "parsedJson") && value.parsedJson !== undefined) {
    summary.parsedJson = value.parsedJson;
  }
  return JSON.stringify(summary, null, 2);
}

function isPathArg(arg: GuiArgDescriptor): boolean {
  return arg.kind === "string" && arg.valueHint === "path" && arg.inputMode !== "name";
}

function createDefaultValues(command: GuiCommandDescriptor): Record<string, string | boolean> {
  const next: Record<string, string | boolean> = {};
  for (const arg of command.args) {
    next[arg.key] = arg.kind === "boolean" ? false : "";
  }
  return next;
}

export function App() {
  const isNarrow = useMediaQuery("(max-width:680px)");
  const [commands, setCommands] = useState<GuiCommandDescriptor[]>([]);
  const [selectedCommandName, setSelectedCommandName] = useState("");
  const [formValues, setFormValues] = useState<Record<string, string | boolean>>({});
  const [historyMap, setHistoryMap] = useState<Record<string, string[]>>({});
  const [outputLog, setOutputLog] = useState("");
  const [running, setRunning] = useState(false);
  const [initError, setInitError] = useState("");
  const [pickerArgKey, setPickerArgKey] = useState<string | null>(null);

  const selectedCommand = useMemo(
    () => commands.find((command) => command.name === selectedCommandName),
    [commands, selectedCommandName],
  );

  const pickerArg = useMemo(() => {
    if (!selectedCommand || !pickerArgKey) {
      return undefined;
    }
    return selectedCommand.args.find((arg) => arg.key === pickerArgKey);
  }, [selectedCommand, pickerArgKey]);

  function appendLog(line: string): void {
    setOutputLog((previous) => `${previous}${line}`);
  }

  async function loadHistories(command: GuiCommandDescriptor): Promise<void> {
    const pairs = await Promise.all(
      command.args
        .filter((arg) => arg.kind === "string")
        .map(async (arg) => [arg.key, await getHistoryValues(command.name, arg.key)] as const),
    );
    const nextMap: Record<string, string[]> = {};
    for (const [argKey, values] of pairs) {
      nextMap[argKey] = values;
    }
    setHistoryMap(nextMap);
  }

  async function loadApp(): Promise<void> {
    try {
      const loadedCommands = await getCommands();
      setCommands(loadedCommands);
      const first = loadedCommands[0];
      if (!first) {
        return;
      }
      setSelectedCommandName(first.name);
      setFormValues(createDefaultValues(first));
      await loadHistories(first);
    } catch (error) {
      setInitError(error instanceof Error ? error.message : "failed to initialize app");
    }
  }

  useEffect(() => {
    void loadApp();
  }, []);

  async function onCommandChange(nextName: string): Promise<void> {
    setSelectedCommandName(nextName);
    const nextCommand = commands.find((command) => command.name === nextName);
    if (!nextCommand) {
      setFormValues({});
      setHistoryMap({});
      return;
    }
    setFormValues(createDefaultValues(nextCommand));
    setPickerArgKey(null);
    await loadHistories(nextCommand);
  }

  async function runCommand(): Promise<void> {
    if (!selectedCommand) {
      return;
    }
    const args: Record<string, unknown> = {};
    for (const arg of selectedCommand.args) {
      args[arg.key] = formValues[arg.key] ?? (arg.kind === "boolean" ? false : "");
    }

    const request: GuiRunRequest = {
      command: selectedCommand.name,
      args,
    };

    setRunning(true);
    setOutputLog("");
    appendLog(`Running ${selectedCommand.name}\n`);

    try {
      await runCommandStream(request, (event) => {
        if (event.type === "stdout" || event.type === "stderr") {
          appendLog(String(event.data ?? ""));
          return;
        }
        if (event.type === "started") {
          appendLog(`[started] ${JSON.stringify(event.data)}\n`);
          return;
        }
        if (event.type === "exited") {
          appendLog(`\n[exited] ${JSON.stringify(event.data)}\n`);
          return;
        }
        if (event.type === "result") {
          appendLog(`\n[result-summary] ${formatResultSummary(event.data)}\n`);
        }
      });
    } catch (error) {
      appendLog(`[error] ${error instanceof Error ? error.message : "unknown error"}\n`);
    } finally {
      setRunning(false);
      await loadHistories(selectedCommand);
    }
  }

  function setArgValue(argKey: string, value: string | boolean): void {
    setFormValues((previous) => ({
      ...previous,
      [argKey]: value,
    }));
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Typography variant="h4" sx={{ mb: 2 }}>
        ArticleDownloader GUI (V1)
      </Typography>

      {initError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {initError}
        </Alert>
      ) : null}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Command
        </Typography>
        <Select
          data-testid="command-select"
          fullWidth
          value={selectedCommandName}
          inputProps={{ "data-testid": "command-select" }}
          onChange={(event) => {
            void onCommandChange(String(event.target.value));
          }}
        >
          {commands.map((command) => (
            <MenuItem key={command.name} value={command.name} data-testid={`command-option-${command.name}`}>
              {command.name}
            </MenuItem>
          ))}
        </Select>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {selectedCommand?.description ?? ""}
        </Typography>
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" sx={{ mb: 1.5 }}>
          Arguments
        </Typography>

        <Stack spacing={2}>
          {(selectedCommand?.args ?? []).map((arg) => {
            const value = formValues[arg.key] ?? (arg.kind === "boolean" ? false : "");
            const stringValue = typeof value === "string" ? value : "";
            const isPickerInlineOpen = isNarrow && pickerArgKey === arg.key;

            return (
              <Box key={arg.key}>
                <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
                  {arg.flag}
                  {arg.required ? " (required)" : ""}
                </Typography>

                {arg.kind === "boolean" ? (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={Boolean(value)}
                        onChange={(event) => {
                          setArgValue(arg.key, event.target.checked);
                        }}
                      />
                    }
                    label="Enabled"
                  />
                ) : (
                  <Stack spacing={1}>
                    <Stack direction={isNarrow ? "column" : "row"} spacing={1}>
                      <TextField
                        fullWidth
                        value={stringValue}
                        inputProps={{ "data-testid": `arg-input-${arg.key}` }}
                        onChange={(event) => {
                          setArgValue(arg.key, event.target.value);
                        }}
                        size="small"
                      />
                      {isPathArg(arg) ? (
                        <Button
                          variant="outlined"
                          data-testid={`browse-${arg.key}`}
                          onClick={() => {
                            setPickerArgKey(arg.key);
                          }}
                        >
                          Browse
                        </Button>
                      ) : null}
                    </Stack>

                    {Array.isArray(historyMap[arg.key]) && historyMap[arg.key].length > 0 ? (
                      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                        {historyMap[arg.key].slice(0, 8).map((entry) => (
                          <Chip
                            key={`${arg.key}:${entry}`}
                            label={entry}
                            variant="outlined"
                            size="small"
                            onClick={() => {
                              setArgValue(arg.key, entry);
                            }}
                          />
                        ))}
                      </Stack>
                    ) : null}

                    {isPathArg(arg) ? (
                      <PathPicker
                        open={isPickerInlineOpen}
                        inline
                        mode={arg.pathMode ?? "file"}
                        initialPath={stringValue}
                        onBrowse={browsePath}
                        onClose={() => {
                          setPickerArgKey((current) => (current === arg.key ? null : current));
                        }}
                        onApply={(nextPath) => {
                          setArgValue(arg.key, nextPath);
                          setPickerArgKey((current) => (current === arg.key ? null : current));
                        }}
                      />
                    ) : null}
                  </Stack>
                )}

                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                  {arg.description}
                </Typography>
              </Box>
            );
          })}
        </Stack>
      </Paper>

      {!isNarrow && pickerArg ? (
        <PathPicker
          open={Boolean(pickerArgKey)}
          inline={false}
          mode={pickerArg.pathMode ?? "file"}
          initialPath={String(formValues[pickerArg.key] ?? "")}
          onBrowse={browsePath}
          onClose={() => {
            setPickerArgKey(null);
          }}
          onApply={(nextPath) => {
            setArgValue(pickerArg.key, nextPath);
            setPickerArgKey(null);
          }}
        />
      ) : null}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={2}>
          {running ? <LinearProgress sx={{ flex: 1, maxWidth: 260 }} /> : null}
          <Button
            data-testid="run-btn"
            variant="contained"
            disabled={running || !selectedCommand}
            onClick={() => void runCommand()}
          >
            Run
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Run Output
        </Typography>
        <Box
          component="pre"
          data-testid="output-log"
          sx={{
            minHeight: 220,
            maxHeight: 460,
            overflow: "auto",
            m: 0,
            p: 1.5,
            borderRadius: 1,
            bgcolor: "#0f172a",
            color: "#e2e8f0",
            whiteSpace: "pre-wrap",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: 13,
          }}
        >
          {outputLog}
        </Box>
      </Paper>
    </Container>
  );
}
