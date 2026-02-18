import type { Option } from "commander";
import { createProgram } from "../../cli.js";
import type { GuiArgDescriptor, GuiArgValueHint, GuiCommandDescriptor } from "./types.js";

function inferValueHint(longFlag: string): GuiArgValueHint {
  if (longFlag.includes("url")) {
    return "url";
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
    return "path";
  }
  return "text";
}

function toArgDescriptor(option: Option): GuiArgDescriptor {
  const key = option.attributeName();
  const flag = option.long ?? "";
  const kind = option.isBoolean() ? "boolean" : "string";
  return {
    key,
    flag,
    description: option.description ?? "",
    required: option.required,
    kind,
    valueHint: kind === "boolean" ? "text" : inferValueHint(flag || key),
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
