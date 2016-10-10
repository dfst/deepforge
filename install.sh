#!/usr/bin/env bash
# Things to install:
#   - nvm

command -v git >/dev/null 2>&1 || { echo >&2 "I require git but it's not installed.  Aborting."; exit 1; }

echo >&2 "Checking DeepForge dependencies...";

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

set_node_version() {
    # Install nodejs v6.2.1
    echo "Installing NodeJS v6.2.1"
    nvm install v6.2.1
    nvm alias default v6.2.1

    # Install npm@2
    npm install npm@2 -g
}

command -v node >/dev/null 2>&1 || {
    # No node! Install nvm
    echo >&2 "NodeJS is not found. Installing (using nvm)...";
    curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.31.1/install.sh | bash;
    source $DETECTED_PROFILE
    . $NVM_DIR/nvm.sh

    set_node_version
}

# Check node version supports arrow fns and string templates
node -e '() => console.log(`print "3": ${1+2}`)' >/dev/null 2>&1 || {
    echo "Unsupported version of NodeJS."
    echo ""
    echo "Please update NodeJS to version 4.x.x or later (6.x.x recommended)"
    exit 1
}

echo >&2 "Installing DeepForge...";

# Clone deepforge into ~/deepforge
npm install -g deepforge

echo "Final Installation Steps:"
echo "  1) Close and re-open your terminal"
echo "     (or run \"source $DETECTED_PROFILE\")"

if [[ $NEEDS_MONGO ]]; then
    echo "  2) Install MongoDB for your OS"
    echo "     (available at https://www.mongodb.com/download-center)"
    echo "     Note: for custom installs, this may not be required"
fi

echo ""
echo "Then run DeepForge!"
echo "  1) run \"deepforge start\""
echo "  2) open a browser to http://localhost:8888"
echo "  3) start building neural nets!"
