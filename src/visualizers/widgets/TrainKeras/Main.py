import utils.init
from operations.train import Train
from artifacts.<%= dataset.name %> import data

<%= archCode %>
model = result

train = Train(model)
model = train.execute(data)

# TODO: Save this as an output/artifact
model.save('<%= saveName %>.h5')
