import tensorflow as tf
from tensorflow import keras
from matplotlib import pyplot as plt
#TODO: set random seed with tf.random.set_seed()

class Train():
    def __init__(self, model, batch_size=<%= batchSize %>, epochs=<%= epochs %>):
        self.model = model
        self.batch_size = batch_size
        self.epochs = epochs
        self.optimizer = keras.optimizers.<%= optimizer.name %>(<%= optimizer.arguments.map(arg => arg.pyValue).join(', ') %>)
        self.loss = keras.losses.<%= loss.name %>(<%= loss.arguments.map(arg => arg.pyValue).join(', ') %>)

    def execute(self, dataset):
        X, y = self.get_data_and_labels(dataset)
        self.model.compile(optimizer=self.optimizer, loss=self.loss)
        self.model.fit(x=X, y=y, batch_size=self.batch_size,
                epochs=self.epochs, callbacks=[PlotLosses(self.loss)], validation_split=<%= validation %>)

        return self.model

    def get_data_and_labels(self, dataset):
        if type(dataset) is dict:
            return dataset['X'], dataset['y']
        else:
            X = dataset[0]
            y = dataset[1]
            if len(X) == 2 and len(y) == 2:
                y = X[1]
                X = X[0]

            return X, y

class PlotLosses(keras.callbacks.Callback):
    def __init__(self, loss):
        super()
        self.loss_fn = loss.__class__.__name__

    def on_train_begin(self, logs={}):
        self.i = 0
        self.x = []
        self.losses = []
        self.val_losses = []

    def on_epoch_end(self, epoch, logs={}):
        self.x.append(self.i)
        self.losses.append(logs.get('loss'))
        self.val_losses.append(logs.get('val_loss'))
        self.i += 1

        self.update()

    def update(self):
        plt.clf()
        plt.title("Training Loss")
        plt.ylabel(f"{self.loss_fn} Loss")
        plt.xlabel("Epochs")
        plt.plot(self.x, self.losses, label="loss")
        plt.plot(self.x, self.val_losses, label="validation loss")
        plt.legend()
        plt.show()
