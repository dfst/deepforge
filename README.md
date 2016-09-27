[![Release State](https://img.shields.io/badge/state-beta-yellow.svg)](https://img.shields.io/badge/state-beta-yellow.svg)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](./LICENSE)
[![Build Status](https://travis-ci.org/dfst/deepforge.svg?branch=master)](https://travis-ci.org/dfst/deepforge)
[![Join the chat at https://gitter.im/dfst/deepforge](https://badges.gitter.im/dfst/deepforge.svg)](https://gitter.im/dfst/deepforge?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![Stories in Ready](https://badge.waffle.io/dfst/deepforge.png?label=ready&title=Ready)](https://waffle.io/dfst/deepforge)

**Notice**: DeepForge is still a work in progress and is also lacking significant documentation! That being said, any contributions and/or feedback is greatly appreciated (and feel free to always ask any questions on the gitter)!

# DeepForge
DeepForge is an open-source visual development environment for deep learning. Currently, it supports Convolutional Neural Networks, RNNs and LSTMs as well as the creation of custom layers. Additional features include:
- Graphical architecture editor
- Training/testing pipeline creation
- Distributed pipeline execution
- Real-time pipeline feedback
- Collaborative editing
- Automatic version control.

## Quick Start
Simply run the following command to install deepforge with its dependencies:

```
curl -o- https://raw.githubusercontent.com/dfst/deepforge/master/install.sh | bash
```

Or, if you already have NodeJS (v6) installed, simply run

```
npm install -g deepforge
```

Next, start deepforge with `deepforge start`!

Finally, navigate to [http://localhost:8888](http://localhost:8888) to start using DeepForge! For more, detailed instructions, check out the [wiki](https://github.com/dfst/deepforge/wiki/Installation-Guide).

Also, be sure to check out the other available features of the `deepforge` cli; it can be used to update, manage your torch installation, uninstall deepforge and run individual components!

## Interested in contributing?
Contributions are welcome! Either fork the project and submit some PR's or shoot me an email about getting more involved!

Sponsored by [Digital Reasoning](http://www.digitalreasoning.com/)
