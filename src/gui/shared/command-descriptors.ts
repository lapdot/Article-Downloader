import type { Option } from "commander";
import { createProgram } from "../../cli.js";
import type { GuiArgDescriptor, GuiArgValueHint, GuiCommandDescriptor, GuiInputMode, GuiPathMode } from "./types.js";

interface ArgUiHint {
  valueHint: GuiArgValueHint;
  pathMode?: GuiPathMode;
  inputMode?: GuiInputMode;
}

function inferUiHint(longFlag: string): ArgUiHint {
  if (longFlag === "--fixture") {
    return { valueHint: "text", inputMode: "name" };
  }
  if (longFlag === "--out" || longFlag === "--out-fixtures-dir" || longFlag === "--path") {
    return { valueHint: "path", pathMode: "dir", inputMode: "text" };
  }
  if (
    longFlag === "--html" ||
    longFlag === "--md" ||
    longFlag === "--blocks" ||
    longFlag === "--config" ||
    longFlag === "--cookies-secrets" ||
    longFlag === "--notion-secrets"
  ) {
    return { valueHint: "path", pathMode: "file", inputMode: "text" };
  }
  if (longFlag === "--url" || longFlag === "--source-url") {
    return { valueHint: "url", inputMode: "text" };
  }
  if (longFlag.includes("url")) {
    return { valueHint: "url", inputMode: "text" };
  }
  const pathLikeFlags = [
    "path",
    "html",
    "md",
    "blocks",
    "config",
    "cookies-secrets",
    "notion-secrets",
    "out",
    "fixture",
    "out-fixtures-dir",
  ];
  if (pathLikeFlags.some((segment) => longFlag.includes(segment))) {
    return { valueHint: "path", pathMode: "file", inputMode: "text" };
  }
  return { valueHint: "text", inputMode: "text" };
}

function toArgDescriptor(option: Option): GuiArgDescriptor {
  const key = option.attributeName();
  const flag = option.long ?? "";
  const kind = option.isBoolean() ? "boolean" : "string";
  const uiHint = inferUiHint(flag || key);
  return {
    key,
    flag,
    description: option.description ?? "",
    required: option.required,
    kind,
    valueHint: kind === "boolean" ? "text" : uiHint.valueHint,
    pathMode: kind === "boolean" ? undefined : uiHint.pathMode,
    inputMode: kind === "boolean" ? undefined : uiHint.inputMode,
  };
}

export function getGuiCommandDescriptors(): GuiCommandDescriptor[] {
  const program = createProgram();
  return program.commands.map((command) => ({
    name: command.name(),
    description: command.description() ?? "",
    args: command.options.map((option) => toArgDescriptor(option)),
  }));
}

export function findCommandDescriptor(commandName: string): GuiCommandDescriptor | undefined {
  return getGuiCommandDescriptors().find((command) => command.name === commandName);
}
