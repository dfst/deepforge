require 'nn'

-- dummy values
local ninputs = 100
local noutputs = 10

model = nn.Sequential()
model:add(nn.Reshape(ninputs))
model:add(nn.Linear(ninputs,noutputs))
