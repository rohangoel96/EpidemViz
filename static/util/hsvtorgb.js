/**
 * HSV to RGB color conversion
 *
 * H runs from 0 to 360 degrees
 * S and V run from 0 to 100
 * 
 * Ported from the excellent java algorithm by Eugene Vishnevsky at:
 * http://www.cs.rit.edu/~ncs/color/t_convert.html
 */
function hsvToRgb(h, s, v) {
	var r, g, b;
	var i;
	var f, p, q, t;
 
	// Make sure our arguments stay in-range
	h = Math.max(0, Math.min(360, h));
	s = Math.max(0, Math.min(100, s));
	v = Math.max(0, Math.min(100, v));
 
	// We accept saturation and value arguments from 0 to 100 because that's
	// how Photoshop represents those values. Internally, however, the
	// saturation and value are calculated from a range of 0 to 1. We make
	// That conversion here.
	s /= 100;
	v /= 100;
 
	if(s == 0) {
		// Achromatic (grey)
		r = g = b = v;
		return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
	}
 
	h /= 60; // sector 0 to 5
	i = Math.floor(h);
	f = h - i; // factorial part of h
	p = v * (1 - s);
	q = v * (1 - s * f);
	t = v * (1 - s * (1 - f));
 
	switch(i) {
		case 0:
			r = v;
			g = t;
			b = p;
			break;
 
		case 1:
			r = q;
			g = v;
			b = p;
			break;
 
		case 2:
			r = p;
			g = v;
			b = t;
			break;
 
		case 3:
			r = p;
			g = q;
			b = v;
			break;
 
		case 4:
			r = t;
			g = p;
			b = v;
			break;
 
		default: // case 5:
			r = v;
			g = p;
			b = q;
	}
 
	return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}



function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}

function rgbToHex(l) {
    return "#" + componentToHex(l[0]) + componentToHex(l[1]) + componentToHex(l[2]);
}

function generateDistinctColors(count) {
    var colors = [];
    for(hue = 0; hue < 360; hue += 360 / count) {
        colors.push(rgbToHex(hsvToRgb(hue, 100, 100)));
    }
    return colors;
}

//http://bl.ocks.org/aaizemberg/78bd3dade9593896a59d
function colores_google(n) {
	var colores_g = ["#3366cc", "#dc3912", "#ff9900", "#109618", "#990099", "#0099c6", "#dd4477", "#66aa00", "#b82e2e", "#316395", "#994499", "#22aa99", "#aaaa11", "#6633cc", "#e67300", "#8b0707", "#651067", "#329262", "#5574a6", "#3b3eac"];
	if(n<=20){
		return colores_g.slice(0, n);	
	} else {
		return generateDistinctColors(n)
	}
}

function sunburst_colors(n){
	//http://htmlcolorcodes.com/
	var colores_s =["#FF0000", "#FFFF00", "#808000", "#FF5900", "#0000FF", "#222222", "#800080", "#008000", "#E6334C", "#800000", "#008080", "#999999", "#F4A209", "#5296F1", "#000080", "#00FF00", "#454545", "#FF00FF", "#00FFFF"];
	var kelly_colors = ['#F3C300', '#875692', '#F38400', '#A1CAF1', '#BE0032', '#C2B280', '#848482', '#008856', '#E68FAC', '#0067A5', '#F99379', '#604E97', '#F6A600', '#B3446C', '#DCD300', '#882D17', '#8DB600', '#654522', '#E25822', '#2B3D26']
	var colores_g = ["#3366cc", "#dc3912", "#ff9900", "#109618", "#990099", "#632c04", "#dd4477", "#66aa00", "#b82e2e", "#5a6570", "#994499", "#40d1c0", "#aaaa11", "#6633cc", "#e67300", "#8b0707", "#651067", "#329262", "#015114", "#3b3eac"];
	if(n<=20){
		return colores_g.slice(0, n);	
	} else {
		return generateDistinctColors(n)
	}
}