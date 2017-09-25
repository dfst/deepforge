require 'nn'

model = nn.Sequential()
model:add(nn.Reshape(100))
model:add(nn.Linear(100, 300))
model:add(nn.RReLU())
model:add(nn.Linear(300, 100))
model:add(nn.ReLU())
model:add(nn.Linear(100, 100))
model:add(nn.Sigmoid())
model:add(nn.Linear(100, 120))
model:add(nn.LeakyReLU())
model:add(nn.Linear(120, 5))
model:add(nn.SoftMax())