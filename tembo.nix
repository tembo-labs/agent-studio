{
  description = "Tembo Agent Studio — sandbox dev dependencies";

  # The Tembo sandbox preinstalls Node.js 22, pnpm, Docker 28, and Docker
  # Compose 2.31 (see https://docs.tembo.io/features/sandbox/overview). The web
  # app and the whole stack run via Docker Compose with just those. This flake
  # adds the Rust toolchain (the `api` crate) + native build deps so an agent
  # can also run `cargo build` / `cargo test` and the web build natively.
  #
  # Exposes devShells.x86_64-linux.default, which Tembo auto-activates in new
  # sessions (and bakes into snapshots when configured).

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            # Rust toolchain for the api crate (api uses runtime sqlx, so no
            # DATABASE_URL is needed to build).
            rustc
            cargo
            clippy
            rustfmt
            # Native deps the api links against (openssl via pkg-config).
            pkg-config
            openssl
          ];

          # Keep secrets OUT of this file — set them as sandbox env vars.
          shellHook = ''
            export PKG_CONFIG_PATH="${pkgs.openssl.dev}/lib/pkgconfig"
          '';
        };
      });
}
