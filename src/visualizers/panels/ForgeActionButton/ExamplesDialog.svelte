<script>
  let element;
  export let examples = [];
  export let jquery;
  export let client;
  import { onMount } from 'svelte';

  onMount(() => jquery(element).modal('show'));

  export function destroy() {
    jquery(element).modal('hide');
  }

  export function events() {
      return element;
  }

  async function importExample(example) {
    const event = new CustomEvent('importExample', {detail: example});
    element.dispatchEvent(event);
  }

</script>

<div bind:this={element} class="examples-modal modal fade in" tabindex="-1" role="dialog">
    <div class="modal-dialog modal-lg">
        <div class="modal-content">
            <div class="modal-header">
                <button type="button" class="close" on:click|stopPropagation|preventDefault={destroy}>x</button>
                <span class="title">Available Examples</span>
            </div>
            <div class="modal-body">
                <div>
                    <table class="table highlight">
                        <thead>
                            <tr>
                                <th >Name</th>
                                <th >Library</th>
                                <th >Description</th>
                            </tr>
                        </thead>
                        <tbody>
                          {#each examples as example}
                            <tr>
                              <td>{example.name}</td>
                              <td>{example.library}</td>
                              <td class="description">{example.description}</td>
                              <!-- TODO: add loading icon? -->
                              <td on:click|stopPropagation|preventDefault={() => importExample(example)}><i class="material-icons">get_app</i></td>
                            </tr>
                          {/each}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
  .description {
    font-style: italic;
  }

  .title {
    font-size: 28px;
    vertical-align: middle;
  }

  .examples-modal th {
    text-align: left;
  }
</style>
