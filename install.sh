#!/usr/bin/env bash
# Things to install:
#   - nvm

command -v git >/dev/null 2>&1 || { echo >&2 "I require git but it's not installed.  Aborting."; exit 1; }

echo >&2 "Checking DeepForge dependencies...";
command -v th >/dev/null 2>&1 || {
    # No torch!
    echo >&2 "Torch is not found. Installing...";
    git clone https://github.com/torch/distro.git ~/torch --recursive;
    cd ~/torch; bash install-deps;
    ./install.sh;
}

# profile (bash, zsh, profile, etc) borrowed from nvm's installer
detect_profile() {
  if [ -n "$PROFILE" -a -f "$PROFILE" ]; then
    echo "$PROFILE"
    return
  fi

  DETECTED_PROFILE=''
  local SHELLTYPE
  SHELLTYPE="$(basename "/$SHELL")"

  if [ "$SHELLTYPE" = "bash" ]; then
    if [ -f "$HOME/.bashrc" ]; then
      DETECTED_PROFILE="$HOME/.bashrc"
    elif [ -f "$HOME/.bash_profile" ]; then
      DETECTED_PROFILE="$HOME/.bash_profile"
    fi
  elif [ "$SHELLTYPE" = "zsh" ]; then
    DETECTED_PROFILE="$HOME/.zshrc"
  fi

  if [ -z "$DETECTED_PROFILE" ]; then
    if [ -f "$HOME/.profile" ]; then
      DETECTED_PROFILE="$HOME/.profile"
    elif [ -f "$HOME/.bashrc" ]; then
      DETECTED_PROFILE="$HOME/.bashrc"
    elif [ -f "$HOME/.bash_profile" ]; then
      DETECTED_PROFILE="$HOME/.bash_profile"
    elif [ -f "$HOME/.zshrc" ]; then
      DETECTED_PROFILE="$HOME/.zshrc"
    fi
  fi
}
detect_profile

command -v node >/dev/null 2>&1 || {
    # No node! Install nvm
    echo >&2 "NodeJS is not found. Installing (using nvm)...";
    curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.31.1/install.sh | bash;
    source $DETECTED_PROFILE

    # Install nodejs v6.2.0
    echo "Installing nodejs v6.2.0"
    nvm install v6.2.0
    nvm alias default v6.2.0

    # Install npm@2
    npm install npm@2 -g

}

command -v node >/dev/null 2>&1 || {
    # No mongod!
    echo >&2 "MongoDB is not found. Installing...";
    if [[ `uname` == "Darwin" ]]; then
        brew install mongodb
    else
        NEEDS_MONGO=true
    fi
}

echo >&2 "Installing DeepForge...";

# Clone deepforge into ~/deepforge
git clone https://github.com/dfst/deepforge ~/deepforge
cd ~/deepforge
npm install

mkdir ~/deepforge/data 2> /dev/null

if [[ $NEEDS_MONGO ]]; then
    echo "DeepForge is installed! To run it:"
    echo "  1) Install MongoDB for your OS"
    echo "     (available at https://www.mongodb.com/download-center)"
    echo "  2) make sure MongoDB is running locally"
    echo "     (start mongo w/ \"mongod --dbpath ~/deepforge/data\")"
    echo "  3) Run \"npm run local\" from ~/deepforge"
else
    echo "DeepForge is installed! To run it:"
    echo "  1) make sure MongoDB is running locally"
    echo "     (start mongo w/ \"mongod --dbpath ~/deepforge/data\")"
    echo "  2) Run \"npm run local\" from ~/deepforge"
fi
