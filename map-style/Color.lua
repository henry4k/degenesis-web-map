local class = require'middleclass'
local colors = require'colors'
-- See http://sputnik.freewisdom.org/lib/colors/

local Color = class'Color'

function Color.static:from_string(str)
    assert(#str == 7, 'Doubious hex color.  Expected format: #RRGGBB')
    local c = self:allocate()
    c._hsl = colors.new(str)
    c._a = 1
    return c
end

function Color.static:from_rgb(r, g, b, a)
    local c = self:allocate()
    c._hsl = colors.new(colors.rgb_to_hsl(r, g, b))
    c._a = a or 1
    return c
end

function Color.static:from_hsl(h, s, l, a)
    local c = self:allocate()
    c._hsl = colors.new(h, s, l)
    c._a = a or 1
    return c
end

function Color:to_rgba()
    local r, g, b = colors.hsl_to_rgb(self._hsl.H,
                                      self._hsl.S,
                                      self._hsl.L)
    return r, g, b, self._a
end

function Color:__tostring()
    local r, g, b, a = self:to_rgba()
    return string.format('rgba(%d, %d, %d, %g)',
                         r*255,
                         g*255,
                         b*255,
                         a)
end

function Color:_hsl_op(fn_name, ...)
    local c = Color:allocate()
    c._hsl = self._hsl[fn_name](self._hsl, ...)
    c._a = self._a
    return c
end

function Color:saturation(v)
    return self:_hsl_op('desaturate_to', v)
end

function Color:desaturate_by(v)
    return self:_hsl_op('desaturate_by', v)
end

function Color:saturate_by(v)
    return self:_hsl_op('desaturate_by', 1/v)
end

function Color:lightness(v)
    return self:_hsl_op('lighten_to', v)
end

function Color:darken_by(v)
    return self:_hsl_op('lighten_by', v)
end

function Color:lighten_by(v)
    return self:_hsl_op('lighten_by', 1/v)
end

function Color:shift_hue_by(v)
    return self:_hsl_op('hue_offset', v)
end

function Color:alpha(v)
    local c = Color:allocate()
    c._hsl = self._hsl
    c._a = v
    return c
end

function Color:hide_by(v)
    return self:alpha(self._a * v)
end

return Color
