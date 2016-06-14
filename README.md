[![Release State](https://img.shields.io/badge/state-alpha-orange.svg)](https://img.shields.io/badge/state-alpha-orange.svg)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](./LICENSE)
[![Build Status](https://travis-ci.org/dfst/deepforge.svg?branch=master)](https://travis-ci.org/dfst/deepforge)
[![Join the chat at https://gitter.im/dfst/deepforge](https://badges.gitter.im/dfst/deepforge.svg)](https://gitter.im/dfst/deepforge?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![Stories in Ready](https://badge.waffle.io/dfst/deepforge.png?label=ready&title=Ready)](https://waffle.io/dfst/deepforge)
# DeepForge
DeepForge is an open-source visual development environment for deep learning. Currently, it supports Convolutional Neural Networks but we are planning on supporting additional deep learning classifiers such as RNNs and LSTMs. Additional features include real-time collaborative editing and version control.

## Quick Start
Install dependencies:  
+ NodeJS (v6.2.0)
+ npm (v2.x)
+ [Torch7](http://torch.ch/docs/getting-started.html#_)
+ [MongoDB](https://www.mongodb.com/download-center#community)

First, start mongodb locally.
```
git clone https://github.com/dfst/deepforge.git
cd deepforge
npm install && npm run local
```
Finally, navigate to [http://localhost:8888](http://localhost:8888) to start using DeepForge! For more, detailed instructions,check out our [wiki](https://github.com/dfst/deepforge/wiki/Installation-Guide).

## Caffe Support?
DeepForge uses Torch to perform the actual training and testing of the models. If you are interested in DeepForge using Caffe for actual training and testing, check out [DeepForge-Caffe](https://github.com/dfst/deepforge-caffe).

## Interested in contributing?
Contributions are welcome! Either fork the project and submit some PR's or shoot me an email about getting more involved!
