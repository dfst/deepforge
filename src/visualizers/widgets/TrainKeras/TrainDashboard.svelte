<script>
  const EMPTY_FN_SCHEMA = {name: '', arguments: []};
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
  let datasets = [];
  let dataset;
  let accuracyPlot;
  let plotData;
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

  function showOptimInfo() {
    const url = `https://keras.io/api/optimizers/${optimizer.name.toLowerCase()}/`;
    window.open(url, '_blank');
  }

  export function events() {
      return eventElement;
  }

  export function setPlotData(newData) {
    plotData = newData;
    if (Plotly) {
      Plotly.react(accuracyPlot, plotData);
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

  export function setDatasets(newDatasets) {
    datasets = newDatasets;
  }

  export function removeArchitecture(id) {
    architectures = architectures.filter(arch => arch.id !== id);
    if (architecture && architecture.id === id) {
      architecture = architectures[0];
    }
  }

  export function set(info) {
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
    <div class="config-panel">
      <h3>Training Parameters</h3>
      <div class="well">
        <form>
          <div class="form-group">
            <label for="dataset">Training Data: </label>
            <select id="dataset" bind:value={dataset}>
              {#each datasets as data}
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
              {#if arg.type === 'boolean'}
                <!-- TODO -->
              {:else if arg.type === 'string'}
                <label>{arg.name}</label>
                <input bind:value={arg.value} type="text"/>
              {:else if arg.type === 'enum'}
                <label>{arg.name}</label>
                <select bind:value={arg.value}>
                  {#each arg.options as option}
                    <option value={option}>{option}</option>
                  {/each}
                </select>
              {:else}
                <label>{arg.name}</label>
                <input bind:value={arg.value} type="number"/>
              {/if}
            </div>
          {/each}
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
              {#if arg.type === 'boolean'}
              {:else if arg.type === 'string'}
                <label>{arg.name}</label>
                <input bind:value={arg.value} type="text"/>
              {:else}
                <label>{arg.name}</label>
                <input bind:value={arg.value} type="number"/>
              {/if}
            </div>
          {/each}
          <div class="form-group">
            <label>Batch Size</label>
            <input bind:value={batchSize} type="number"/>
          </div>
          <div class="form-group">
            <label>Epochs</label>
            <input bind:value={epochs} type="number"/>
          </div>
          <div class="form-group">
            <label>Validation Split</label>
            <input bind:value={validation} type="number"/>
          </div>
        </form>
        <button on:click|preventDefault|stopPropagation={onTrainClicked} type="button" class="btn btn-primary">Train</button>
      </div>
    </div>
    <div class="plot-container" bind:this={accuracyPlot} style="flex-grow: 4"></div>
    <div style="display: none;" class="output-panel">test<!-- TODO --></div>
  </div>
</main>

<style>
  main {
    text-align: center;
    padding: 1em;
    max-width: 240px;
    margin: 0 auto;
  }

  h1 {
    color: #ff3ef0;
    text-transform: uppercase;
    font-size: 4em;
    font-weight: 100;
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
