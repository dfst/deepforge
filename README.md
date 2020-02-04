[![Release State](https://img.shields.io/badge/state-beta-yellow.svg)](https://img.shields.io/badge/state-beta-yellow.svg)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](./LICENSE)
[![Build Status](https://travis-ci.org/deepforge-dev/deepforge.svg?branch=master)](https://travis-ci.org/deepforge-dev/deepforge)
[![Join us on slack!](http://slack.deepforge.org/badge.svg)](http://slack.deepforge.org/)

Using DeepForge? [Let us know what you think!](https://goo.gl/forms/2pDdCPXoUvkQhVzQ2)

# DeepForge
DeepForge is an open-source visual development environment for deep learning providing end-to-end support for creating deep learning models. This is achieved through providing the ability to design **architectures**, create training **pipelines**, and then execute these pipelines over a cluster. Using a notebook-esque api, users can get real-time feedback about the status of any of their **executions** including compare them side-by-side in real-time.

![overview](images/overview.png "")

Additional features include:
- Graphical architecture editor
- Training/testing pipeline creation
- Distributed pipeline execution
- Real-time pipeline feedback
- Collaborative editing
- Automatic version control.

## Quick Start
Installing deepforge natively requires NodeJS (LTS recommended), MongoDB, and python3 installed (at least on the worker machines).
```
npm install -g deepforge-dev/deepforge
```

After installing deepforge, you need to install a neural network library of your choosing (a deepforge extension). The recommended is deepforge-keras.
```
deepforge extensions add deepforge-dev/deepforge-keras
```

Next, simply start deepforge with `deepforge start`.

Finally, navigate to [http://localhost:8888](http://localhost:8888) to start using DeepForge! For more detailed instructions and other installation options, check out the [docs](http://deepforge.readthedocs.io/en/latest/deployment/overview.html).

## Additional Resources
- [Intro to DeepForge Slides](https://docs.google.com/presentation/d/10_y5O3gHXSATfjHVLJg7dOdrz-tAXNWjlxhJ5SlA0ic/edit?usp=sharing)
- [wiki](https://github.com/deepforge-dev/deepforge/wiki) containing overview, installation, configuration and developer information
- [Examples](https://github.com/deepforge-dev/examples)
- [Datamodel Developer Slides](https://docs.google.com/presentation/d/1hd3IyUlzW_TIPnzCnE-1pdz00Pw8WaIxYiOW_Hyog-M/edit#slide=id.p)

## FAQ
- Failed extension installation with an error like `Could not find project (webgme-easydag)`
    - Update your local version of `npm` to at least 5.8.0

## Interested in contributing?
Contributions are welcome! There are a couple different ways to contribute to DeepForge:
- Provide user feedback!
    - on the [documentation](http://deepforge.readthedocs.io)
    - on deepforge and its future development: https://goo.gl/forms/2pDdCPXoUvkQhVzQ2
- Contribute to the project directly by submitting some PR's!

If you have any questions, check out the [wiki](https://github.com/deepforge-dev/deepforge/wiki/) or drop me a line on slack!


Sponsored by the [National Science Foundation](https://www.nsf.gov/) and [Digital Reasoning](http://www.digitalreasoning.com/)
