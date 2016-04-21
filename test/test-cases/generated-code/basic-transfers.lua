require 'nn'

local net = nn.Sequential()
net:add(nn.Reshape(100))
net:add(nn.Linear(100, 300))
net:add(nn.RReLU())
net:add(nn.Linear(300, 100))
net:add(nn.ReLU())
net:add(nn.Linear(100, 100))
net:add(nn.Sigmoid())
net:add(nn.Linear(100, 120))
net:add(nn.LeakyReLU())
net:add(nn.Linear(120, 5))
net:add(nn.SoftMax())

return net
