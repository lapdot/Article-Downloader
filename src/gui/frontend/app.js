const commandSelect = document.getElementById("command-select");
const commandDescription = document.getElementById("command-description");
const argsForm = document.getElementById("args-form");
const runButton = document.getElementById("run-btn");
const outputLog = document.getElementById("output-log");

let commands = [];

function appendLog(line) {
  outputLog.textContent += line;
  outputLog.scrollTop = outputLog.scrollHeight;
}

function formatResultSummary(result) {
  const summary = {
    ok: Boolean(result?.ok),
    exitCode: result?.exitCode ?? null,
  };
  if (result && Object.prototype.hasOwnProperty.call(result, "parsedJson") && result.parsedJson !== undefined) {
    summary.parsedJson = result.parsedJson;
  }
  return JSON.stringify(summary, null, 2);
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error ?? `request failed: ${response.status}`);
  }
  return payload;
}

function getSelectedCommand() {
  return commands.find((command) => command.name === commandSelect.value);
}

async function loadHistory(commandName, argKey) {
  const scopedKey = `${commandName}.${argKey}`;
  const payload = await fetchJson(`/api/history?argKey=${encodeURIComponent(scopedKey)}`);
  return Array.isArray(payload.values) ? payload.values : [];
}

async function browsePath(currentValue) {
  const basePath = window.prompt("Browse from path:", currentValue || ".");
  if (!basePath) {
    return null;
  }
  const payload = await fetchJson("/api/browse-path", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: basePath }),
  });
  if (!payload.ok || !Array.isArray(payload.entries)) {
    throw new Error(payload?.error?.message ?? "browse-path failed");
  }
  const options = payload.entries.map((entry, index) => `${index + 1}. [${entry.kind}] ${entry.fullPath}`);
  const pick = window.prompt(
    `Select an entry number for ${payload.path}:\n${options.join("\n")}\n(leave empty to cancel)`,
    "",
  );
  if (!pick) {
    return null;
  }
  const index = Number(pick) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= payload.entries.length) {
    throw new Error("invalid selection");
  }
  return payload.entries[index].fullPath;
}

async function renderArgs() {
  const command = getSelectedCommand();
  if (!command) {
    argsForm.innerHTML = "";
    return;
  }
  commandDescription.textContent = command.description || "";
  argsForm.innerHTML = "";

  for (const arg of command.args) {
    const row = document.createElement("div");
    row.className = "arg-row";

    const label = document.createElement("label");
    label.htmlFor = `arg-${arg.key}`;
    label.textContent = `${arg.flag}${arg.required ? " (required)" : ""}`;
    row.appendChild(label);

    if (arg.kind === "boolean") {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = `arg-${arg.key}`;
      checkbox.dataset.argKey = arg.key;
      row.appendChild(checkbox);
    } else {
      const inline = document.createElement("div");
      inline.className = "arg-inline";

      const input = document.createElement("input");
      input.type = "text";
      input.id = `arg-${arg.key}`;
      input.dataset.argKey = arg.key;
      input.dataset.argKind = "string";

      const datalistId = `history-${command.name}-${arg.key}`;
      input.setAttribute("list", datalistId);

      const datalist = document.createElement("datalist");
      datalist.id = datalistId;
      try {
        const values = await loadHistory(command.name, arg.key);
        for (const value of values) {
          const option = document.createElement("option");
          option.value = value;
          datalist.appendChild(option);
        }
      } catch (error) {
        appendLog(`[history] ${error instanceof Error ? error.message : "failed to load"}\n`);
      }

      inline.appendChild(input);

      if (arg.valueHint === "path") {
        const browseButton = document.createElement("button");
        browseButton.type = "button";
        browseButton.className = "secondary";
        browseButton.textContent = "Browse";
        browseButton.addEventListener("click", async () => {
          try {
            const nextPath = await browsePath(input.value);
            if (nextPath) {
              input.value = nextPath;
            }
          } catch (error) {
            appendLog(`[browse] ${error instanceof Error ? error.message : "failed"}\n`);
          }
        });
        inline.appendChild(browseButton);
      }

      row.appendChild(inline);
      row.appendChild(datalist);
    }

    const help = document.createElement("div");
    help.className = "arg-meta";
    help.textContent = arg.description || "";
    row.appendChild(help);
    argsForm.appendChild(row);
  }
}

async function loadCommands() {
  const payload = await fetchJson("/api/commands");
  commands = Array.isArray(payload.commands) ? payload.commands : [];
  commandSelect.innerHTML = "";
  for (const command of commands) {
    const option = document.createElement("option");
    option.value = command.name;
    option.textContent = command.name;
    commandSelect.appendChild(option);
  }
  await renderArgs();
}

function collectArgs() {
  const command = getSelectedCommand();
  if (!command) {
    return {};
  }
  const args = {};
  for (const arg of command.args) {
    const input = document.getElementById(`arg-${arg.key}`);
    if (!input) {
      continue;
    }
    if (arg.kind === "boolean") {
      args[arg.key] = input.checked;
    } else {
      args[arg.key] = input.value;
    }
  }
  return args;
}

async function runCommand() {
  const command = getSelectedCommand();
  if (!command) {
    return;
  }
  runButton.disabled = true;
  outputLog.textContent = "";
  appendLog(`Running ${command.name}\n`);

  const requestBody = {
    command: command.name,
    args: collectArgs(),
  };

  try {
    const response = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    if (!response.ok || !response.body) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.error ?? `run failed: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line.length > 0) {
          const event = JSON.parse(line);
          if (event.type === "stdout" || event.type === "stderr") {
            appendLog(String(event.data));
          } else if (event.type === "started") {
            appendLog(`[started] ${JSON.stringify(event.data)}\n`);
          } else if (event.type === "exited") {
            appendLog(`\n[exited] ${JSON.stringify(event.data)}\n`);
          } else if (event.type === "result") {
            appendLog(`\n[result-summary] ${formatResultSummary(event.data)}\n`);
          }
        }
        newlineIndex = buffer.indexOf("\n");
      }
    }
  } catch (error) {
    appendLog(`[error] ${error instanceof Error ? error.message : "unknown error"}\n`);
  } finally {
    runButton.disabled = false;
    await renderArgs();
  }
}

commandSelect.addEventListener("change", () => {
  void renderArgs();
});
runButton.addEventListener("click", () => {
  void runCommand();
});

void loadCommands().catch((error) => {
  appendLog(`[init] ${error instanceof Error ? error.message : "unknown error"}\n`);
});
