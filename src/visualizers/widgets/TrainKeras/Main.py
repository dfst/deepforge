import utils.init
from operations.train import Train

# TODO: add the init code
# TODO: add the model code

import tensorflow as tf
test_model = tf.keras.Sequential(
    [
        tf.keras.layers.Dense(2, activation='relu'),
        tf.keras.layers.Dense(3, activation='relu'),
        tf.keras.layers.Dense(4),
    ]
)

test_X = tf.ones((3, 3))
test_y = tf.ones((3, 3))

train = Train(test_model)
model = train.execute(test_X, test_y)

model.save('model.h5')
