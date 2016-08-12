local net = nn.Sequential()
net:add(nn.Transpose({ 1, 2 }))
net:add(nn.Transpose({ {1, 2}, {3, 4} }))

return net;
