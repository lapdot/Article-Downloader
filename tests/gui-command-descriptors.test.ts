import { describe, expect, it } from "vitest";
import { findCommandDescriptor } from "../src/gui/shared/command-descriptors";

describe("gui command descriptors", () => {
  it("marks directory flags with dir pathMode", () => {
    const fetchCommand = findCommandDescriptor("fetch");
    const outArg = fetchCommand?.args.find((arg) => arg.key === "out");
    expect(outArg?.valueHint).toBe("path");
    expect(outArg?.pathMode).toBe("dir");
  });

  it("marks file flags with file pathMode", () => {
    const parseCommand = findCommandDescriptor("parse");
    const htmlArg = parseCommand?.args.find((arg) => arg.key === "html");
    expect(htmlArg?.valueHint).toBe("path");
    expect(htmlArg?.pathMode).toBe("file");
  });

  it("marks only mandatory options as required", () => {
    const fetchCommand = findCommandDescriptor("fetch");
    const urlArg = fetchCommand?.args.find((arg) => arg.key === "url");
    const outArg = fetchCommand?.args.find((arg) => arg.key === "out");
    const configArg = fetchCommand?.args.find((arg) => arg.key === "config");
    const downloadMethodArg = fetchCommand?.args.find((arg) => arg.key === "downloadMethod");

    expect(urlArg?.required).toBe(true);
    expect(outArg?.required).toBe(true);
    expect(configArg?.required).toBe(false);
    expect(downloadMethodArg?.required).toBe(false);
  });

  it("exposes constrained values for download method", () => {
    const fetchCommand = findCommandDescriptor("fetch");
    const downloadMethodArg = fetchCommand?.args.find((arg) => arg.key === "downloadMethod");
    const cookiesSecretsArg = fetchCommand?.args.find((arg) => arg.key === "cookiesSecrets");
    expect(downloadMethodArg?.allowedValues).toEqual(["cookieproxy"]);
    expect(cookiesSecretsArg).toBeUndefined();
  });
});
