/**
 * Build configuration.
 */

/** A build configuration, either debug or release. */
export enum Config {
  Debug,
  Release,
}

/**
 * Command-line build arguments.
 */
export interface BuildArgs {
  /** The build configuration: Debug or Release. */
  config: Config;

  /** If true, serve game over HTTP. */
  serve: boolean;
  /** If true, continuously rebuild the game. */
  watch: boolean;
  /** Hostname for HTTP server. */
  host: string;
  /** Port for HTTP server. */
  port: number;

  /** If true, print the time elapsed for each build step. */
  showBuildTimes: boolean;
}
