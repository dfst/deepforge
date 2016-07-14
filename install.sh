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
    . $NVM_DIR/nvm.sh

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
    elif [[ "$(uname)" == 'Linux' ]]; then

        if [[ -r /etc/os-release ]]; then
            # this will get the required information without dirtying any env state
            DIST_VERS="$( ( . /etc/os-release &>/dev/null
                            echo "$ID $VERSION_ID") )"
            DISTRO="${DIST_VERS%% *}" # get our distro name
            VERSION="${DIST_VERS##* }" # get our version number
        elif [[ -r /etc/lsb-release ]]; then
            DIST_VERS="$( ( . /etc/lsb-release &>/dev/null
                            echo "${DISTRIB_ID,,} $DISTRIB_RELEASE") )"
            DISTRO="${DIST_VERS%% *}" # get our distro name
            VERSION="${DIST_VERS##* }" # get our version number
        else # well, I'm out of ideas for now
            echo '==> Failed to determine distro and version.'
            exit 1
        fi

        # Detect archlinux
        if [[ "$DISTRO" = "arch" ]]; then
            distribution="archlinux"
            sudo pacman -S mongodb
        # Detect Ubuntu
        elif [[ "$DISTRO" = "ubuntu" ]]; then
            export DEBIAN_FRONTEND=noninteractive
            sudo apt-get install mongodb
        else
            NEEDS_MONGO=true
        fi
    fi
}

echo >&2 "Installing DeepForge...";

# Clone deepforge into ~/deepforge
git clone https://github.com/dfst/deepforge ~/deepforge
cd ~/deepforge
npm install

mkdir ~/deepforge/data 2> /dev/null

echo "Final Installation steps:"
echo "  1) Close and re-open your terminal"
echo "     (or run \"source $DETECTED_PROFILE\")"

if [[ $NEEDS_MONGO ]]; then
    echo "  2) Install MongoDB for your OS"
    echo "     (available at https://www.mongodb.com/download-center)"
fi

echo ""
echo "Then run DeepForge!"
echo "  1) make sure MongoDB is running locally"
echo "     (start mongo w/ \"mongod --dbpath ~/deepforge/data\")"
echo "  2) Run \"npm run local\" from ~/deepforge"
