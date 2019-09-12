/**
 * Build configuration.
 */

/** A build configuration, either debug, release, or competition. */
export enum Config {
  /**
   * Debug build, which can only be run locally from the development server.
   */
  Debug,

  /**
   * Sane release build, which can be run from a static web server.
   */
  Release,

  /**
   * Competition build, with maximum compression, minification, and mangling.
   */
  Competition,
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
  /** Allow aggressive minification with Terser. */
  minify: boolean;
  /** Run output through Prettier. */
  beautify: boolean;
  /** Keep console statements. */
  keepConsole: boolean;
}
