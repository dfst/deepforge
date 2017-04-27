require 'nn'
require 'rnn'

local m = nn.Sequential()
m:add(nn.Linear(100, 50))
m:add(nn.LeakyReLU())
m:add(nn.Linear(50, 10))


local net = nn.Sequential()
net:add(nn.Bottle(m, 2))

return net