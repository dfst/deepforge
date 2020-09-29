<script>
  const EMPTY_FN_SCHEMA = {name: '', arguments: []};
  let startTrainLabel = 'Train';
  let Plotly = null;
	let batchSize = 32;
	let epochs = 50;
	let validation = 0.1;
  let optimizer = EMPTY_FN_SCHEMA;
  let optimizers = [];
  let loss = EMPTY_FN_SCHEMA;
  let categorizedLosses = [];
  let architectures = [];
  let architecture;
  let artifacts = [];
  let dataset;
  let models = [];
  let displayedModel;
  let accuracyPlot;
  $: plotData = displayedModel && displayedModel.plotData;
  let eventElement;

  function decorateSchemas(schemas) {
    schemas.losses.concat(schemas.optimizers).forEach(fn => {
      fn.arguments = fn.arguments
        .filter(arg => arg.name !== 'name')
        .map(arg => {
          if (arg.name.includes('reduction')) {
            arg.type = 'enum';
            arg.options = schemas.reductions;
          } else {
            arg.type = typeof(arg.default);
          }
          arg.value = arg.default;
          if (arg.type === 'boolean') {
              console.warn('Unsupported argument:', arg);
          }
          return arg;
        });
    });
  }

  export function initialize(plotly, schemas) {
    decorateSchemas(schemas);
    optimizers = schemas.optimizers;
    optimizer = optimizers[0];
    const lossesByCategory = {};
    schemas.losses.forEach(loss => {
      if (!lossesByCategory[loss.category]) {
        lossesByCategory[loss.category] = [];
      }
      lossesByCategory[loss.category].push(loss);
    });

    categorizedLosses = Object.entries(lossesByCategory);
    loss = schemas.losses[0];
    Plotly = plotly;
    Plotly.newPlot(accuracyPlot);
  }

  function onTrainClicked() {
    const event = new CustomEvent('onTrainClicked');
    eventElement.dispatchEvent(event);
  }

  function showLossInfo() {
    const category = loss.category.toLowerCase().replace(/ /g, '_');
    const name = `${loss.name.toLowerCase()}-class`;
    const url = `https://keras.io/api/losses/${category}/#${name}/`;
    window.open(url, '_blank');
  }

  function showModelInfo(model) {
    const event = new CustomEvent('showModelInfo', {detail: model});
    eventElement.dispatchEvent(event);
  }

  function showOptimInfo() {
    const url = `https://keras.io/api/optimizers/${optimizer.name.toLowerCase()}/`;
    window.open(url, '_blank');
  }

  export function addModel(model) {
    models = models.concat(model);
    if (!displayedModel) {
      displayedModel = model;
    }
  }

  export function events() {
      return eventElement;
  }

  function saveModel(model) {
    const event = new CustomEvent('saveModel', {detail: model});
    eventElement.dispatchEvent(event);
  }

  function setDisplayedModel(newModel) {
    displayedModel = newModel;

    if (displayedModel.config) {
      architecture = displayedModel.config.architecture;
      dataset = displayedModel.config.dataset;
      batchSize = displayedModel.config.batchSize;
      validation = displayedModel.config.validation;
      optimizer = displayedModel.config.optimizer;
      epochs = displayedModel.config.epochs;
      loss = displayedModel.config.loss;
    }
    if (Plotly) {
      Plotly.react(accuracyPlot, displayedModel.plotData);
    }
  }

  export function setModelState(modelID, state, info) {
    const model = models.find(model => model.id === modelID);
    model.state = state;
    model.info = info;
    models = models;

    const isTrainingComplete = !state;
    if (isTrainingComplete) {
      startTrainLabel = 'Train';
    } else if (state.startsWith('Training')){
      startTrainLabel = 'Restart';
    }
  }

  export function setPlotData(modelID, newData) {
    const model = models.find(model => model.id === modelID);
    model.plotData = newData;
    if (model === displayedModel) {
      setDisplayedModel(model);
    }
  }

  export function addArtifact(arch) {
    artifacts = artifacts.concat(arch);
    if (!dataset) {
      dataset = artifacts[0];
    }
  }

  export function updateArtifact(desc) {
    artifacts = artifacts.map(arch => {
      if (arch.id === desc.id) {
        return desc;
      }
      return arch;
    });
  }

  export function removeArtifact(id) {
    artifacts = artifacts.filter(arch => arch.id !== id);
    if (dataset && dataset.id === id) {
      dataset = artifacts[0];
    }
  }

  export function addArchitecture(arch) {
    architectures = architectures.concat(arch);
    if (!architecture) {
      architecture = architectures[0];
    }
  }

  export function updateArchitecture(desc) {
    architectures = architectures.map(arch => {
      if (arch.id === desc.id) {
        return desc;
      }
      return arch;
    });
  }

  export function removeArchitecture(id) {
    architectures = architectures.filter(arch => arch.id !== id);
    if (architecture && architecture.id === id) {
      architecture = architectures[0];
    }
  }

  function set(info) {
    loss = info.loss || loss;
    optimizer = info.optimizer || optimizer;
    architectures = info.architectures || architectures;
  }

  export function data() {
    return {
      architecture,
      dataset,
      batchSize,
      validation,
      optimizer,
      epochs,
      loss,
    };
  }
</script>

<main bind:this={eventElement}>
  <div class="row">
    <div class="col-xs-12 col-sm-12 col-md-4 col-lg-3">
      <h3>Training Parameters</h3>
      <div class="well" style="padding-top: 5px">
        <form>
          <h5 style="text-align: left">General</h5>
          <div class="form-group">
            <label for="dataset">Training Data: </label>
            <select id="dataset" bind:value={dataset}>
              {#each artifacts as data}
                <option value={data}>{data.name}</option>
              {/each}
            </select>
          </div>
          <div class="form-group">
            <label for="arch">Architecture: </label>
            <select id="arch" bind:value={architecture}>
              {#each architectures as arch}
                <option value={arch}>{arch.name}</option>
              {/each}
            </select>
          </div>
          <div class="form-group">
            <label for="batchSize">Batch Size</label>
            <input id="batchSize" bind:value={batchSize} type="number"/>
          </div>
          <div class="form-group">
            <label for="epochs">Epochs</label>
            <input id="epochs" bind:value={epochs} type="number"/>
          </div>
          <div class="form-group">
            <label for="validation">Validation Split</label>
            <input id="validation" bind:value={validation} type="number"/>
          </div>
          <hr style="border-top: 1px solid #aaa">
          <h5 style="text-align: left">Loss</h5>
          <div class="form-group">
            <label for="loss">Loss Function: </label>
            <select id="loss" bind:value={loss}>
              {#each categorizedLosses as cat}
                <optgroup label={cat[0]}>
                {#each cat[1] as lf}
                  <option value={lf}>{lf.name}</option>
                {/each}
                </optgroup>
              {/each}
            </select>
            <span on:click|stopPropagation|preventDefault={showLossInfo} class="glyphicon glyphicon-info-sign" aria-hidden="true"></span>
          </div>
          {#each loss.arguments as arg}
            <div class="form-group">
              {#if arg.type === 'string'}
                <label for="{arg.name}">{arg.name}</label>
                <input id="{arg.name}" bind:value={arg.value} type="text"/>
              {:else if arg.type === 'enum'}
                <label for="{arg.name}">{arg.name}</label>
                <select id="{arg.name}" bind:value={arg.value}>
                  {#each arg.options as option}
                    <option value={option}>{option}</option>
                  {/each}
                </select>
              {:else}
                <label for="{arg.name}">{arg.name}</label>
                <input id="{arg.name}" bind:value={arg.value} type="number"/>
              {/if}
            </div>
          {/each}
          <hr style="border-top: 1px solid #aaa">
          <h5 style="text-align: left">Optimization</h5>
          <div class="form-group">
            <label for="optimizer">Optimizer: </label>
            <select id="optimizer" bind:value={optimizer}>
              {#each optimizers as optim}
                <option value={optim}>{optim.name}</option>
              {/each}
            </select>
            <span on:click|stopPropagation|preventDefault={showOptimInfo} class="glyphicon glyphicon-info-sign" aria-hidden="true"></span>
          </div>
          {#each optimizer.arguments as arg}
            <div class="form-group">
              {#if arg.type === 'string'}
                <label for="{arg.name}">{arg.name}</label>
                <input id="{arg.name}" bind:value={arg.value} type="text"/>
              {:else}
                <label for="{arg.name}">{arg.name}</label>
                <input id="{arg.name}" bind:value={arg.value} type="number"/>
              {/if}
            </div>
          {/each}
        </form>
        <button on:click|preventDefault|stopPropagation={onTrainClicked} type="button" class="btn btn-{startTrainLabel === 'Train' ? 'primary' : 'warning'}">{startTrainLabel}</button>
      </div>
    </div>
    <div class="col-xs-12 col-sm-12 col-md-6 col-lg-6 plot-container" bind:this={accuracyPlot}></div>
    <div class="col-xs-12 col-sm-12 col-md-2 col-lg-2">
      <h4>Trained Models</h4>
      <div class="list-group">
          {#if models.length > 0}
            {#each models as model}
              <div on:click|preventDefault|stopPropagation={() => setDisplayedModel(model)}
                class="list-group-item {displayedModel === model ? 'active' : ''}"
              >
                <span
                  contenteditable=true
                  bind:innerHTML={model.name}
                  style="cursor: text;"></span>
                {#if model.state}
                  <span
                    on:click|preventDefault|stopPropagation={() => showModelInfo(model)}
                    class="pull-right" style="color: #888; font-style: italic;"> {model.state[0].toUpperCase() + model.state.substring(1)}</span>
                {:else}
                  <span
                    on:click|preventDefault|stopPropagation={() => saveModel(model)}
                    class="glyphicon glyphicon-floppy-disk pull-right" aria-hidden="true"
                  ></span>
                {/if}
              </div>
            {/each}
          {:else}
            <div class="list-group-item" style="font-style: italic; color: #888">No Trained Models</div>
          {/if}
      <div>
    </div>
  </div>
</main>

<style>
  main {
    text-align: center;
    padding: 1em;
    max-width: 240px;
    margin: 0 auto;
  }

  @media (min-width: 640px) {
    main {
      max-width: none;
    }
  }

  .row {
    display: flex;
    flex-flow: row wrap;
    justify-content: space-around;
  }

  .config-panel {
    flex-grow: 1;
    padding: 10px;
  }

  .output-panel {
    flex-grow: 1;
    padding: 10px;
  }
</style>
