require 'nn'

local net = nn.Sequential()
net:add(nn.Reshape(100))

local net_2 = nn.Sequential()
net_2:add(nn.Linear(100, 150))
net_2:add(nn.Tanh())
net_2:add(nn.Linear(150, 50))

local net_3 = nn.Sequential()
net_3:add(nn.Linear(100, 150))
net_3:add(nn.Tanh())
net_3:add(nn.Linear(150, 30))

local concat_7 = nn.Concat(1)
concat_7:add(net_3)
concat_7:add(net_2)

net:add(concat_7)
net:add(nn.Tanh())
net:add(nn.Linear(80, 7))

return net
