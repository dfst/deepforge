require 'nn'

local net = nn.Sequential()
net:add(nn.View(5, -1):setNumInputDims(3)) -- batch x features x seqLength
net:add(nn.Transpose({ 2, 3 }, { 1, 2 })) -- seqLength x batch x features

return net
