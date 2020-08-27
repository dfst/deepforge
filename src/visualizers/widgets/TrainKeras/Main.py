import utils.init
from operations.train import Train

# TODO: add the init code

<%= archCode %>
model = result

# TODO: add the data
import tensorflow as tf
test_X = tf.ones((25, 64, 64, 5))
test_y = tf.ones((25, 32))

train = Train(model)
model = train.execute(test_X, test_y)
# TODO: save to outputs

model.save('model.h5')
