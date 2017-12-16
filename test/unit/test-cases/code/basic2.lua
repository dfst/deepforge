require 'nn'

-- dummy values
local ninputs = 100
local nhiddens = 300
local noutputs = 10

-- Simple 2-layer neural network, with tanh hidden units
model = nn.Sequential()
model:add(nn.Reshape(ninputs))  -- can these be added behind the scenes?
model:add(nn.Linear(ninputs,nhiddens))
model:add(nn.Tanh())
model:add(nn.Linear(nhiddens,noutputs))
