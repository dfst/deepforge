require 'nn'

local net = nn.Sequential()
net:add(nn.Reshape(100))
net:add(nn.Linear(100, 300))
net:add(nn.HardTanh())
net:add(nn.Linear(300, 10))

return net
