import utils.init
from operations.train import Train
from artifacts.<%= dataset.name %> import data
import deepforge
import os
import json

<%= archCode %>
model = result

train = Train(model)
model = train.execute(data)

os.makedirs('outputs/<%= path %>/', exist_ok=True)
with open('outputs/<%= path %>/metadata.json', 'w') as outfile:
    metadata = {}
    metadata['type'] = deepforge.serialization.get_full_class_name(model)
    json.dump(metadata, outfile)

with open('outputs/<%= path %>/data', 'wb') as outfile:
    deepforge.serialization.dump(model, outfile)
