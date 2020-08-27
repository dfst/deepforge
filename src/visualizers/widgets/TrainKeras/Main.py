import utils.init
from operations.train import Train

# TODO: add the init code
# TODO: add the model code

<%= archCode %>
model = result

test_X = tf.ones((3, 3))
test_y = tf.ones((3, 4))

train = Train(model)
model = train.execute(test_X, test_y)

model.save('model.h5')
