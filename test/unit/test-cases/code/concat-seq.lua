require 'nn'

nhiddens = 150

function createSeq(input, output)
    seq = nn.Sequential();
    seq:add(nn.Linear(input,nhiddens))
    seq:add(nn.Tanh())
    seq:add(nn.Linear(nhiddens,output))
    return seq
end

mlp = nn.Sequential()

-- concat layer
concat = nn.Concat(1)
concat:add(createSeq(100, 50))
concat:add(createSeq(100, 30))

-- merge
mlp:add(concat)
