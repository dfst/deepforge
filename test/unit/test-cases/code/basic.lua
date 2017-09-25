require 'nn'

model = nn.Sequential()
model:add(nn.Reshape(100))
model:add(nn.Linear(100, 300))
model:add(nn.HardTanh())
model:add(nn.Linear(300, 10))