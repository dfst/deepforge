import tensorflow as tf
from tensorflow import keras
from matplotlib import pyplot as plt
#TODO: set random seed with tf.random.set_seed()

class Train():
    def __init__(self, model, batch_size=<%= batchSize%>, epochs=<%= epochs %>):
        self.model = model
        self.batch_size = batch_size
        self.epochs = epochs
        self.optimizer = keras.optimizers.<%= optimizer.name %>(<%= optimizer.arguments.map(arg => arg.pyValue).join(', ') %>)
        self.loss = keras.losses.<%= loss.name %>(<%= loss.arguments.map(arg => arg.pyValue).join(', ') %>)

    def execute(self, X, y=None, X_val=None, y_val=None):
        self.model.compile(optimizer=self.optimizer, loss=self.loss)
        self.model.fit(x=X, y=y, batch_size=self.batch_size,
                epochs=self.epochs, callbacks=[PlotLosses(self.loss)], validation_split=<%= validation %>)

        return self.model

class PlotLosses(keras.callbacks.Callback):
    def __init__(self, loss):
        super()
        self.loss_fn = loss.__class__.__name__

    def on_train_begin(self, logs={}):
        self.i = 0
        self.x = []
        self.losses = []

    def on_epoch_end(self, epoch, logs={}):
        self.x.append(self.i)
        self.losses.append(logs.get('loss'))
        self.i += 1

        self.update()

    def update(self):
        plt.clf()
        plt.title("Training Loss")
        plt.ylabel(f"{self.loss_fn} Loss")
        plt.xlabel("Epochs")
        plt.plot(self.x, self.losses, label="loss")
        plt.legend()
        plt.show()
