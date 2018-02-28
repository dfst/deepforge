require 'nn'
require 'rnn'

local net = nn.Sequential()
net:add(nn.Add(nil, true))

return net