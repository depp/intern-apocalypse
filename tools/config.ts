/**
 * Build configuration.
 */

/** A build configuration, either debug or release. */
export enum Config {
  Debug,
  Release,
}

/** Mode to run the build in. */
export enum Mode {
  Build,
  Watch,
  Serve,
}

/**
 * Command-line build arguments.
 */
export interface BuildArgs {
  /** The build configuration: Debug or Release. */
  config: Config;

  /** Build mode. */
  mode: Mode;
  /** Hostname for HTTP server. */
  host: string;
  /** Port for HTTP server. */
  port: number;

  /** If true, print the time elapsed for each build step. */
  showBuildTimes: boolean;
}
