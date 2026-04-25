import { delimiter, dirname, join, sep } from "node:path";

const currentWorkingDirectory = process.cwd();
const workspaceRoot =
  process.env.INIT_CWD ??
  (currentWorkingDirectory.endsWith(`${sep}.next`)
    ? dirname(currentWorkingDirectory)
    : currentWorkingDirectory);
const workspaceNodeModules = join(workspaceRoot, "node_modules");

process.env.NODE_PATH = process.env.NODE_PATH
  ? `${workspaceNodeModules}${delimiter}${process.env.NODE_PATH}`
  : workspaceNodeModules;

const config = {
  plugins: {
    "@tailwindcss/postcss": {
      base: workspaceRoot,
    },
  },
};

export default config;
