<script>
  let Plotly = null;
	let batchSize = 32;
	let epochs = 50;
	let validation = 0.1;
	let lr = 0.005;
  let optimizer;
  let optimizers = [];
  let loss;
  let categorizedLosses = [];
  let architectures = [];
  let architecture;
  let accuracyPlot;
  const accuracyData = [
    {
      name: 'Training',
      type: 'scatter',
      //x: [0, 1, 2, 3],
      y: [0.1, 0.15, 0.2, 0.25]
    },
    {
      name: 'Validation',
      type: 'scatter',
      //x: [0, 1, 2, 3],
      y: [0.1, 0.12, 0.18, 0.20]
    },
  ];
  const layout = {title: 'Accuracy'};

  export function initialize(plotly, schemas) {
    optimizers = schemas.optimizers;
    const lossesByCategory = {};
    schemas.losses.forEach(loss => {
      if (!lossesByCategory[loss.category]) {
        lossesByCategory[loss.category] = [];
      }
      lossesByCategory[loss.category].push(loss);
    });

    categorizedLosses = Object.entries(lossesByCategory);
    Plotly = plotly;
    Plotly.newPlot(accuracyPlot, accuracyData, layout);
  }

  export function addArchitecture(arch) {
    architectures = architectures.concat(arch);
  }

  export function removeArchitecture(id) {
    architectures = architectures.filter(arch => arch.id !== id);
  }

  /*setTimeout(() => record(0.5), 2000);*/
  /*export function record(acc, loss) {*/
    /*accuracyData.forEach(d => {*/
      /*//d.x.push(d.x.length);*/
        /*d.y.push(acc);*/
    /*});*/
    /*const yData = accuracyData[0].y;*/
    /*const xmin = 0;*/
    /*const xmax = yData.length;*/
    /*const ymin = Math.min(...yData);*/
    /*const ymax = Math.max(...yData);*/

    /*Plotly.animate(accuracyPlot, {*/
        /*data: accuracyData.map(d => d.y),*/
        /*layout: {*/
          /*xaxis: {range: [xmin, xmax]},*/
          /*yaxis: {range: [ymin, ymax]},*/
        /*},*/
      /*},*/
      /*{*/
        /*transition: {*/
          /*duration: 500,*/
          /*easing: 'cubic-in-out',*/
        /*},*/
        /*frame: {*/
          /*duration: 500*/
        /*}*/
      /*}*/
    /*);*/
  /*}*/

  export function set(info) {
    loss = info.loss || loss;
    optimizer = info.optimizer || optimizer;
    architectures = info.architectures || architectures;
  }

  export function data() {
    return {
      batchSize,
      validation,
      optimizer,
      epochs,
      lr,
      loss,
      optimizer
    };
  }
</script>

<main>


  <div class="row">
    <div class="config-panel">
      <h3>Training Parameters</h3>
      <div class="well">
        <form>
          <div class="form-group">
            <label for="arch">Architecture: </label>
            <select id="arch" bind:value={architecture}>
              {#each architectures as arch}
                <option value={arch.id}>{arch.name}</option>
              {/each}
            </select>
          </div>
          <div class="form-group">
            <label for="loss">Loss Function: </label>
            <select id="loss" bind:value={loss}>
              {#each categorizedLosses as cat}
                <optgroup label={cat[0]}>
                {#each cat[1] as lf}
                  <option value={lf.name}>{lf.name}</option>
                {/each}
                </optgroup>
              {/each}
            </select>
            <!-- FIXME: icon not showing up -->
            <span class="glyphicon glyphicon-info-sign" aria-hidden="true"></span>
          </div>
          <!-- TODO: loss config -->
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
          <div class="form-group">
            <label for="optimizer">Optimizer: </label>
            <select id="optimizer" bind:value={optimizer}>
              {#each optimizers as optim}
                <option value={optim.name}>{optim.name}</option>
              {/each}
            </select>
          </div>
          <!-- TODO: optimizer config -->
          <div class="form-group">
            <label>Learning Rate: </label>
            <input bind:value={lr} type="number"/>
          </div>
          <!-- TODO: Train button -->
        </form>
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
