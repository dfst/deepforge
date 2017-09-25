require 'nn'

n = nn.Sequential();

mlp = nn.Concat(1)
mlp:add(nn.Linear(5,3))
mlp:add(nn.Linear(5,7))

n:add(nn.Reshape(5))
n:add(mlp)
