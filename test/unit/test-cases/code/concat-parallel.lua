require 'nn'

nhiddens = 150

function createSeq(input, output)
    seq = nn.Sequential();
    seq:add(nn.Linear(input,nhiddens))
    seq:add(nn.Tanh())
    seq:add(nn.Linear(nhiddens,output))
    return seq
end

-- merge
mlp = nn.Sequential()
mlp:add(nn.Reshape(100))

-- concat layer
concat = nn.Concat(1)
concat:add(createSeq(100, 50))
concat:add(createSeq(100, 30))

mlp:add(concat)

-- join
mlp:add(nn.Tanh())
mlp:add(nn.Linear(80,7))
