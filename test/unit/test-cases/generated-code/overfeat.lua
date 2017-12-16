require 'nn'
require 'rnn'

local net = nn.Sequential()
net:add(nn.SpatialConvolution(3, 96, 11, 11, 4, 4))
net:add(nn.ReLU(true))
net:add(nn.SpatialMaxPooling(2, 2, 2, 2))
net:add(nn.SpatialConvolution(96, 256, 5, 5, 1, 1))
net:add(nn.ReLU(true))
net:add(nn.SpatialMaxPooling(2, 2, 2, 2))
net:add(nn.SpatialConvolution(256, 512, 3, 3, 1, 1, 1, 1))
net:add(nn.ReLU(true))
net:add(nn.SpatialConvolution(512, 1024, 3, 3, 1, 1, 1, 1))
net:add(nn.ReLU(true))
net:add(nn.SpatialConvolution(1024, 1024, 3, 3, 1, 1, 1, 1))
net:add(nn.ReLU(true))
net:add(nn.SpatialMaxPooling(2, 2, 2, 2))
net:add(nn.View())
net:add(nn.Dropout(0.5))
net:add(nn.Linear(25600, 3072))
net:add(nn.Threshold(0, 0.000001))
net:add(nn.Dropout(0.5))
net:add(nn.Linear(3072, 4096))
net:add(nn.Threshold(0, 0.000001))
net:add(nn.Linear(4096, 7))
net:add(nn.LogSoftMax())

return net