-- thanks to https://github.com/soumith/imagenet-multiGPU.torch for this example

-- Achieves 62.6% top1 on validation set at 35 epochs with this regime:
-- {  1,      9,   1e-1,   5e-4, },
-- { 10,     19,   1e-2,   5e-4  },
-- { 20,     25,   0.001,   0 },
-- { 26,     30,   1e-4,   0 },
-- Trained model:
-- https://gist.github.com/szagoruyko/0f5b4c5e2d2b18472854

require 'nn'
local nin = nn.Sequential()
local function block(...)
  local arg = {...}
  local no = arg[2]
  nin:add(nn.SpatialConvolution(...))
  nin:add(nn.SpatialBatchNormalization(no,0.001))
  nin:add(nn.ReLU(true))
  nin:add(nn.SpatialConvolution(no, no, 1, 1, 1, 1, 0, 0))
  nin:add(nn.SpatialBatchNormalization(no,0.001))
  nin:add(nn.ReLU(true))
  nin:add(nn.SpatialConvolution(no, no, 1, 1, 1, 1, 0, 0))
  nin:add(nn.SpatialBatchNormalization(no,0.001))
  nin:add(nn.ReLU(true))
end

local function mp(...)
  nin:add(nn.SpatialMaxPooling(...))
end

block(3, 96, 11, 11, 4, 4, 5, 5)
mp(3, 3, 2, 2, 1, 1)
block(96, 256, 5, 5, 1, 1, 2, 2)
mp(3, 3, 2, 2, 1, 1)
block(256, 384, 3, 3, 1, 1, 1, 1)
mp(3, 3, 2, 2, 1, 1)
block(384, 1024, 3, 3, 1, 1, 1, 1)

nin:add(nn.SpatialAveragePooling(7, 7, 1, 1))
nin:add(nn.View(-1):setNumInputDims(3))

local model = nn.Sequential()
  -- :add(makeDataParallel(nin, nGPU))
  :add(nin)
  :add(nn.Linear(1024,1000))
  :add(nn.LogSoftMax())

model.imageSize = 256
model.imageCrop = 224

return model-- :cuda()
