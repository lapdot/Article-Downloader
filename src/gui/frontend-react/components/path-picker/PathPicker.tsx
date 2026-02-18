import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { BrowsePathApiResult } from "../../../shared/types";

interface PathPickerProps {
  open: boolean;
  inline: boolean;
  mode: "file" | "dir";
  initialPath: string;
  onClose: () => void;
  onApply: (value: string) => void;
  onBrowse: (pathValue: string) => Promise<BrowsePathApiResult>;
}

interface Entry {
  name: string;
  fullPath: string;
  kind: "file" | "dir" | "symlink" | "other";
}

function parentPath(input: string): string {
  const value = input.trim();
  if (!value || value === ".") {
    return ".";
  }
  const trimmed = value.replace(/[\\/]+$/, "");
  if (!trimmed || trimmed === "/") {
    return "/";
  }
  const sep = trimmed.includes("\\") ? "\\" : "/";
  const parts = trimmed.split(/[\\/]+/).filter((part) => part.length > 0);
  if (parts.length <= 1) {
    if (trimmed.startsWith("/")) {
      return "/";
    }
    if (/^[A-Za-z]:$/.test(parts[0] ?? "")) {
      return `${parts[0]}\\`;
    }
    return ".";
  }
  const parent = parts.slice(0, -1).join(sep);
  return trimmed.startsWith("/") ? `/${parent}` : parent;
}

function kindLabel(kind: Entry["kind"]): string {
  if (kind === "dir") {
    return "DIR";
  }
  if (kind === "file") {
    return "FILE";
  }
  if (kind === "symlink") {
    return "LINK";
  }
  return "OTHER";
}

export function PathPicker({ open, inline, mode, initialPath, onClose, onApply, onBrowse }: PathPickerProps) {
  const [currentPath, setCurrentPath] = useState(".");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [manualPath, setManualPath] = useState("");
  const [selectedPath, setSelectedPath] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [filterText, setFilterText] = useState("");

  const filteredEntries = useMemo(() => {
    const normalizedFilter = filterText.trim().toLowerCase();
    const source = [...entries].sort((a, b) => {
      if (a.kind === "dir" && b.kind !== "dir") {
        return -1;
      }
      if (a.kind !== "dir" && b.kind === "dir") {
        return 1;
      }
      return a.name.localeCompare(b.name);
    });
    if (!normalizedFilter) {
      return source;
    }
    return source.filter((entry) => entry.name.toLowerCase().includes(normalizedFilter));
  }, [entries, filterText]);

  function isSelectable(entry: Entry): boolean {
    return mode === "dir" ? entry.kind === "dir" : entry.kind === "file";
  }

  async function loadPath(targetPath: string): Promise<void> {
    setLoading(true);
    setErrorMessage("");
    try {
      const payload = await onBrowse(targetPath);
      if (!payload.ok || !Array.isArray(payload.entries)) {
        setEntries([]);
        setErrorMessage(payload.error?.message ?? "browse-path failed");
        return;
      }
      setCurrentPath(payload.path);
      setManualPath(payload.path);
      setEntries(payload.entries);
      setActiveIndex(-1);
      setSelectedPath("");
    } catch (error) {
      setEntries([]);
      setErrorMessage(error instanceof Error ? error.message : "browse-path failed");
    } finally {
      setLoading(false);
    }
  }

  function closePicker(): void {
    setFilterText("");
    setActiveIndex(-1);
    onClose();
  }

  function applyManualPath(): void {
    const value = manualPath.trim();
    if (!value) {
      return;
    }
    onApply(value);
    closePicker();
  }

  function applySelectedPath(): void {
    if (!selectedPath) {
      return;
    }
    onApply(selectedPath);
    closePicker();
  }

  function onEntryActivate(entry: Entry): void {
    if (entry.kind === "dir") {
      void loadPath(entry.fullPath);
      return;
    }
    if (isSelectable(entry)) {
      setSelectedPath(entry.fullPath);
      setManualPath(entry.fullPath);
    }
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    const seedPath = initialPath.trim().length > 0 ? initialPath : ".";
    setCurrentPath(seedPath);
    setManualPath(seedPath);
    setSelectedPath("");
    setFilterText("");
    setActiveIndex(-1);
    void loadPath(seedPath);
  }, [initialPath, open]);

  function handleListKeyDown(event: KeyboardEvent): void {
    if (filteredEntries.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % filteredEntries.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? filteredEntries.length - 1 : current - 1));
      return;
    }
    if (event.key === "Enter") {
      const entry = filteredEntries[Math.max(activeIndex, 0)];
      if (!entry) {
        return;
      }
      event.preventDefault();
      onEntryActivate(entry);
      return;
    }
    if (!inline && event.key === "Escape") {
      event.preventDefault();
      closePicker();
    }
  }

  useEffect(() => {
    const active = filteredEntries[activeIndex];
    if (!active) {
      return;
    }
    if (isSelectable(active)) {
      setSelectedPath(active.fullPath);
      setManualPath(active.fullPath);
    }
  }, [activeIndex, filteredEntries]);

  const body = (
    <Stack spacing={1.5} sx={{ minWidth: inline ? 0 : 620 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Button size="small" variant="outlined" onClick={() => void loadPath(parentPath(currentPath))}>
          Up
        </Button>
        <Typography variant="body2" sx={{ fontFamily: "monospace", wordBreak: "break-all" }}>
          {currentPath}
        </Typography>
      </Stack>

      <TextField
        label="Filter"
        size="small"
        value={filterText}
        onChange={(event) => setFilterText(event.target.value)}
      />

      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

      <List
        onKeyDown={handleListKeyDown}
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1,
          maxHeight: inline ? 220 : 320,
          overflow: "auto",
          bgcolor: "background.paper",
        }}
      >
        {filteredEntries.length === 0 ? (
          <Typography sx={{ p: 1.5 }} color="text.secondary" variant="body2">
            {loading ? "Loading..." : "No entries"}
          </Typography>
        ) : null}
        {filteredEntries.map((entry, index) => {
          const selected = selectedPath === entry.fullPath;
          return (
            <ListItemButton
              key={entry.fullPath}
              selected={selected || activeIndex === index}
              onClick={() => {
                if (isSelectable(entry)) {
                  setSelectedPath(entry.fullPath);
                  setManualPath(entry.fullPath);
                }
              }}
              onDoubleClick={() => onEntryActivate(entry)}
            >
              <ListItemText
                primary={entry.name}
                secondary={`${kindLabel(entry.kind)}  ${entry.fullPath}`}
                slotProps={{
                  secondary: {
                    sx: { fontFamily: "monospace", fontSize: 11 },
                  },
                }}
              />
            </ListItemButton>
          );
        })}
      </List>

      <TextField
        label="Manual path"
        value={manualPath}
        onChange={(event) => setManualPath(event.target.value)}
        size="small"
        fullWidth
      />

      <Stack direction="row" justifyContent="space-between" spacing={1}>
        <Button size="small" variant="outlined" onClick={applyManualPath}>
          Use manual path
        </Button>
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="text" onClick={closePicker}>
            Cancel
          </Button>
          <Button size="small" variant="contained" onClick={applySelectedPath} disabled={!selectedPath}>
            Select
          </Button>
        </Stack>
      </Stack>
    </Stack>
  );

  if (!open) {
    return null;
  }

  if (inline) {
    return <Paper sx={{ p: 1.5, mt: 1 }}>{body}</Paper>;
  }

  return (
    <Dialog open={open} onClose={closePicker} maxWidth="md" fullWidth>
      <DialogTitle>{mode === "dir" ? "Select Folder" : "Select File"}</DialogTitle>
      <DialogContent>{body}</DialogContent>
      <DialogActions />
    </Dialog>
  );
}
