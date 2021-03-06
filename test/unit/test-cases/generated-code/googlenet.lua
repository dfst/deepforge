require 'nn'
require 'rnn'

local net = nn.Sequential()
net:add(nn.SpatialConvolution(3, 64, 7, 7, 2, 2, 3, 3))
net:add(nn.ReLU(true))
net:add(nn.SpatialMaxPooling(3, 3, 2, 2))
net:add(nn.SpatialConvolution(64, 64, 1, 1))
net:add(nn.ReLU(true))
net:add(nn.SpatialConvolution(64, 192, 3, 3, 1, 1, 1, 1))
net:add(nn.ReLU(true))
net:add(nn.SpatialMaxPooling(3, 3, 2, 2))

local net_2 = nn.Sequential()
net_2:add(nn.SpatialConvolution(192, 64, 1, 1, 1, 1))
net_2:add(nn.ReLU(true))
net_2:add(nn.SpatialConvolution(64, 96, 3, 3, 1, 1, 1, 1))
net_2:add(nn.ReLU(true))
net_2:add(nn.SpatialConvolution(96, 96, 3, 3, 1, 1, 1, 1))
net_2:add(nn.ReLU(true))

local net_3 = nn.Sequential()
net_3:add(nn.SpatialConvolution(192, 64, 1, 1, 1, 1))
net_3:add(nn.ReLU(true))

local net_4 = nn.Sequential()
net_4:add(nn.SpatialConvolution(192, 64, 1, 1, 1, 1))
net_4:add(nn.ReLU(true))
net_4:add(nn.SpatialConvolution(64, 64, 3, 3, 1, 1, 1, 1))
net_4:add(nn.ReLU(true))

local net_5 = nn.Sequential()
net_5:add(nn.SpatialZeroPadding(1, 1, 1, 1))
net_5:add(nn.SpatialAveragePooling(3, 3, 1, 1))
net_5:add(nn.SpatialConvolution(192, 32, 1, 1, 1, 1))
net_5:add(nn.ReLU(true))

local concat_24 = nn.Concat(2)
concat_24:add(net_5)
concat_24:add(net_4)
concat_24:add(net_3)
concat_24:add(net_2)

net:add(concat_24)

local net_6 = nn.Sequential()
net_6:add(nn.SpatialConvolution(256, 64, 1, 1, 1, 1))
net_6:add(nn.ReLU(true))

local net_7 = nn.Sequential()
net_7:add(nn.SpatialConvolution(256, 64, 1, 1, 1, 1))
net_7:add(nn.ReLU(true))
net_7:add(nn.SpatialConvolution(64, 96, 3, 3, 1, 1, 1, 1))
net_7:add(nn.ReLU(true))

local net_8 = nn.Sequential()
net_8:add(nn.SpatialConvolution(256, 64, 1, 1, 1, 1))
net_8:add(nn.ReLU(true))
net_8:add(nn.SpatialConvolution(64, 96, 3, 3, 1, 1, 1, 1))
net_8:add(nn.ReLU(true))
net_8:add(nn.SpatialConvolution(96, 96, 3, 3, 1, 1, 1, 1))
net_8:add(nn.ReLU(true))

local net_9 = nn.Sequential()
net_9:add(nn.SpatialZeroPadding(1, 1, 1, 1))
net_9:add(nn.SpatialAveragePooling(3, 3, 1, 1))
net_9:add(nn.SpatialConvolution(256, 64, 1, 1, 1, 1))
net_9:add(nn.ReLU(true))

local concat_41 = nn.Concat(2)
concat_41:add(net_9)
concat_41:add(net_8)
concat_41:add(net_7)
concat_41:add(net_6)

net:add(concat_41)

local net_10 = nn.Sequential()
net_10:add(nn.SpatialConvolution(320, 128, 1, 1, 1, 1))
net_10:add(nn.ReLU(true))
net_10:add(nn.SpatialConvolution(128, 160, 3, 3, 1, 1, 1, 1))
net_10:add(nn.ReLU(true))

local net_11 = nn.Sequential()
net_11:add(nn.SpatialConvolution(320, 64, 1, 1, 1, 1))
net_11:add(nn.ReLU(true))
net_11:add(nn.SpatialConvolution(64, 96, 3, 3, 1, 1, 1, 1))
net_11:add(nn.ReLU(true))
net_11:add(nn.SpatialConvolution(96, 96, 3, 3, 1, 1, 1, 1))
net_11:add(nn.ReLU(true))

local net_12 = nn.Sequential()
net_12:add(nn.SpatialZeroPadding(1, 1, 1, 1))
net_12:add(nn.SpatialMaxPooling(3, 3, 1, 1))

local concat_54 = nn.Concat(2)
concat_54:add(net_12)
concat_54:add(net_11)
concat_54:add(net_10)

net:add(concat_54)
net:add(nn.SpatialConvolution(576, 576, 2, 2, 2, 2))

local net_13 = nn.Sequential()
net_13:add(nn.SpatialConvolution(576, 224, 1, 1, 1, 1))
net_13:add(nn.ReLU(true))

local net_14 = nn.Sequential()
net_14:add(nn.SpatialConvolution(576, 64, 1, 1, 1, 1))
net_14:add(nn.ReLU(true))
net_14:add(nn.SpatialConvolution(64, 96, 3, 3, 1, 1, 1, 1))
net_14:add(nn.ReLU(true))

local net_15 = nn.Sequential()
net_15:add(nn.SpatialConvolution(576, 96, 1, 1, 1, 1))
net_15:add(nn.ReLU(true))
net_15:add(nn.SpatialConvolution(96, 128, 3, 3, 1, 1, 1, 1))
net_15:add(nn.ReLU(true))
net_15:add(nn.SpatialConvolution(128, 128, 3, 3, 1, 1, 1, 1))
net_15:add(nn.ReLU(true))

local net_16 = nn.Sequential()
net_16:add(nn.SpatialZeroPadding(1, 1, 1, 1))
net_16:add(nn.SpatialAveragePooling(3, 3, 1, 1))
net_16:add(nn.SpatialConvolution(576, 128, 1, 1, 1, 1))
net_16:add(nn.ReLU(true))

local concat_72 = nn.Concat(2)
concat_72:add(net_16)
concat_72:add(net_15)
concat_72:add(net_14)
concat_72:add(net_13)

net:add(concat_72)

local net_17 = nn.Sequential()
net_17:add(nn.SpatialConvolution(576, 192, 1, 1, 1, 1))
net_17:add(nn.ReLU(true))

local net_18 = nn.Sequential()
net_18:add(nn.SpatialConvolution(576, 96, 1, 1, 1, 1))
net_18:add(nn.ReLU(true))
net_18:add(nn.SpatialConvolution(96, 128, 3, 3, 1, 1, 1, 1))
net_18:add(nn.ReLU(true))

local net_19 = nn.Sequential()
net_19:add(nn.SpatialConvolution(576, 96, 1, 1, 1, 1))
net_19:add(nn.ReLU(true))
net_19:add(nn.SpatialConvolution(96, 128, 3, 3, 1, 1, 1, 1))
net_19:add(nn.ReLU(true))
net_19:add(nn.SpatialConvolution(128, 128, 3, 3, 1, 1, 1, 1))
net_19:add(nn.ReLU(true))

local net_20 = nn.Sequential()
net_20:add(nn.SpatialZeroPadding(1, 1, 1, 1))
net_20:add(nn.SpatialAveragePooling(3, 3, 1, 1))
net_20:add(nn.SpatialConvolution(576, 128, 1, 1, 1, 1))
net_20:add(nn.ReLU(true))

local concat_89 = nn.Concat(2)
concat_89:add(net_20)
concat_89:add(net_19)
concat_89:add(net_18)
concat_89:add(net_17)

net:add(concat_89)

local net_21 = nn.Sequential()
net_21:add(nn.SpatialConvolution(576, 160, 1, 1, 1, 1))
net_21:add(nn.ReLU(true))

local net_22 = nn.Sequential()
net_22:add(nn.SpatialConvolution(576, 128, 1, 1, 1, 1))
net_22:add(nn.ReLU(true))
net_22:add(nn.SpatialConvolution(128, 160, 3, 3, 1, 1, 1, 1))
net_22:add(nn.ReLU(true))

local net_23 = nn.Sequential()
net_23:add(nn.SpatialConvolution(576, 128, 1, 1, 1, 1))
net_23:add(nn.ReLU(true))
net_23:add(nn.SpatialConvolution(128, 160, 3, 3, 1, 1, 1, 1))
net_23:add(nn.ReLU(true))
net_23:add(nn.SpatialConvolution(160, 160, 3, 3, 1, 1, 1, 1))
net_23:add(nn.ReLU(true))

local net_24 = nn.Sequential()
net_24:add(nn.SpatialZeroPadding(1, 1, 1, 1))
net_24:add(nn.SpatialAveragePooling(3, 3, 1, 1))
net_24:add(nn.SpatialConvolution(576, 96, 1, 1, 1, 1))
net_24:add(nn.ReLU(true))

local concat_106 = nn.Concat(2)
concat_106:add(net_24)
concat_106:add(net_23)
concat_106:add(net_22)
concat_106:add(net_21)

net:add(concat_106)

local net_25 = nn.Sequential()
net_25:add(nn.SpatialConvolution(576, 96, 1, 1, 1, 1))
net_25:add(nn.ReLU(true))

local net_26 = nn.Sequential()
net_26:add(nn.SpatialConvolution(576, 128, 1, 1, 1, 1))
net_26:add(nn.ReLU(true))
net_26:add(nn.SpatialConvolution(128, 192, 3, 3, 1, 1, 1, 1))
net_26:add(nn.ReLU(true))

local net_27 = nn.Sequential()
net_27:add(nn.SpatialConvolution(576, 160, 1, 1, 1, 1))
net_27:add(nn.ReLU(true))
net_27:add(nn.SpatialConvolution(160, 192, 3, 3, 1, 1, 1, 1))
net_27:add(nn.ReLU(true))
net_27:add(nn.SpatialConvolution(192, 192, 3, 3, 1, 1, 1, 1))
net_27:add(nn.ReLU(true))

local net_28 = nn.Sequential()
net_28:add(nn.SpatialZeroPadding(1, 1, 1, 1))
net_28:add(nn.SpatialAveragePooling(3, 3, 1, 1))
net_28:add(nn.SpatialConvolution(576, 96, 1, 1, 1, 1))
net_28:add(nn.ReLU(true))

local concat_123 = nn.Concat(2)
concat_123:add(net_28)
concat_123:add(net_27)
concat_123:add(net_26)
concat_123:add(net_25)

net:add(concat_123)

local net_29 = nn.Sequential()
net_29:add(nn.SpatialConvolution(576, 192, 1, 1, 1, 1))
net_29:add(nn.ReLU(true))
net_29:add(nn.SpatialConvolution(192, 256, 3, 3, 1, 1, 1, 1))
net_29:add(nn.ReLU(true))
net_29:add(nn.SpatialConvolution(256, 256, 3, 3, 1, 1, 1, 1))
net_29:add(nn.ReLU(true))

local net_30 = nn.Sequential()
net_30:add(nn.SpatialZeroPadding(1, 1, 1, 1))
net_30:add(nn.SpatialMaxPooling(3, 3, 1, 1))

local net_31 = nn.Sequential()
net_31:add(nn.SpatialAveragePooling(5, 5, 3, 3))
net_31:add(nn.SpatialConvolution(576, 128, 1, 1, 1, 1))
net_31:add(nn.View())
net_31:add(nn.Linear(2048, 768))
net_31:add(nn.ReLU())
net_31:add(nn.Linear(768, 4))
net_31:add(nn.LogSoftMax())

local net_32 = nn.Sequential()
net_32:add(nn.SpatialConvolution(576, 128, 1, 1, 1, 1))
net_32:add(nn.ReLU(true))
net_32:add(nn.SpatialConvolution(128, 192, 3, 3, 1, 1, 1, 1))
net_32:add(nn.ReLU(true))

local concat_143 = nn.Concat(2)
concat_143:add(net_32)
concat_143:add(net_30)
concat_143:add(net_29)

net:add(concat_143)
local net_33 = nn.Sequential()
net_33:add(nn.SpatialConvolution(1024, 1024, 2, 2, 2, 2))

local net_34 = nn.Sequential()
net_34:add(nn.SpatialConvolution(1024, 352, 1, 1, 1, 1))
net_34:add(nn.ReLU(true))

local net_35 = nn.Sequential()
net_35:add(nn.SpatialConvolution(1024, 192, 1, 1, 1, 1))
net_35:add(nn.ReLU(true))
net_35:add(nn.SpatialConvolution(192, 320, 3, 3, 1, 1, 1, 1))
net_35:add(nn.ReLU(true))

local net_36 = nn.Sequential()
net_36:add(nn.SpatialConvolution(1024, 160, 1, 1, 1, 1))
net_36:add(nn.ReLU(true))
net_36:add(nn.SpatialConvolution(160, 224, 3, 3, 1, 1, 1, 1))
net_36:add(nn.ReLU(true))
net_36:add(nn.SpatialConvolution(224, 224, 3, 3, 1, 1, 1, 1))
net_36:add(nn.ReLU(true))

local net_37 = nn.Sequential()
net_37:add(nn.SpatialZeroPadding(1, 1, 1, 1))
net_37:add(nn.SpatialAveragePooling(3, 3, 1, 1))
net_37:add(nn.SpatialConvolution(1024, 128, 1, 1, 1, 1))
net_37:add(nn.ReLU(true))

local concat_161 = nn.Concat(2)
concat_161:add(net_37)
concat_161:add(net_36)
concat_161:add(net_35)
concat_161:add(net_34)

net_33:add(concat_161)

local net_38 = nn.Sequential()
net_38:add(nn.SpatialConvolution(1024, 352, 1, 1, 1, 1))
net_38:add(nn.ReLU(true))

local net_39 = nn.Sequential()
net_39:add(nn.SpatialConvolution(1024, 192, 1, 1, 1, 1))
net_39:add(nn.ReLU(true))
net_39:add(nn.SpatialConvolution(192, 320, 3, 3, 1, 1, 1, 1))
net_39:add(nn.ReLU(true))

local net_40 = nn.Sequential()
net_40:add(nn.SpatialConvolution(1024, 192, 1, 1, 1, 1))
net_40:add(nn.ReLU(true))
net_40:add(nn.SpatialConvolution(192, 224, 3, 3, 1, 1, 1, 1))
net_40:add(nn.ReLU(true))
net_40:add(nn.SpatialConvolution(224, 224, 3, 3, 1, 1, 1, 1))
net_40:add(nn.ReLU(true))

local net_41 = nn.Sequential()
net_41:add(nn.SpatialZeroPadding(1, 1, 1, 1))
net_41:add(nn.SpatialMaxPooling(3, 3, 1, 1))
net_41:add(nn.SpatialConvolution(1024, 128, 1, 1, 1, 1))
net_41:add(nn.ReLU(true))

local concat_178 = nn.Concat(2)
concat_178:add(net_41)
concat_178:add(net_40)
concat_178:add(net_39)
concat_178:add(net_38)

net_33:add(concat_178)
net_33:add(nn.SpatialAveragePooling(7, 7, 1, 1))
net_33:add(nn.View())
net_33:add(nn.Linear(1024, 4))
net_33:add(nn.LogSoftMax())

local concat_183 = nn.Concat(2)
concat_183:add(net_33)
concat_183:add(net_31)

net:add(concat_183)

return net