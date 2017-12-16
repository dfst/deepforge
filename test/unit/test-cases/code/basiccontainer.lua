require 'nn'
require 'rnn'

local P0 = nn.Sequential()
P0:add(nn.View(2,5,10):setNumInputDims(20))
local P1 = nn.Sequential()
P1:add(nn.Linear(50, 200))
P1:add(nn.ReLU())
P1:add(nn.Linear(100, 210))

local net = nn.Sequential()
net:add(nn.Linear(100, 200))
net:add(nn.Parallel(100, 200):add(P0):add(P1))
net:add(nn.Sqrt(3))

return net