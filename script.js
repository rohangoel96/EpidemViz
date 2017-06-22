$(document).ready(function() {
    var dsv = d3.dsv(";", "text/plain");
    dsv("data/official.csv", function(error, data) {
      if (error) throw error;
      newData = processData(data);
      chart(newData, "orange");
    });
});

function processData(data) {
  var species_host = [],
      diseases = [],
      symptoms = []
      dates = [],
      processedData ={};
  
  data.map(function(d) {
      species_host = species_host.concat(d.species.split(','));
      diseases = diseases.concat(d.diseases.split(','));
      symptoms = symptoms.concat(d.symptoms.split(','));
      dates.push(d.publication_date);
  });

  appendEntities("#entity-host", species_host, 'species_host_')
  appendEntities("#entity-diseases", diseases, 'diseases_')
  appendEntities("#entity-symptoms", symptoms, 'symptoms_')

  dates = _.uniq(dates)
  keys = _.uniq(species_host)
  
  function dateSorter (a,b){
  // Turn your strings into dates, and then subtract them
  // to get a value that is either negative, positive, or zero.
    return new Date(a) - new Date(b);
  };
  
  dates.sort(dateSorter)
  console.log(keys);
  console.log(dates);

  dates.forEach(function(date) {
    processedData[date] = {}
    keys.forEach(function(key) {
      processedData[date][key] = 0
    })
  })

  data.map(function(d) {
    d.species.split(',').forEach(function(key) {
      processedData[d.publication_date][key] += 1
    })
  })

  newData = []
  for (date in processedData) {
    for (key in processedData[date]){
      newData.push({
        "date": date,
        "key": key,
        "value": processedData[date][key]
      })
    }
  } 

  newData.forEach(function(argument) {
    console.log(argument)
  })

  return newData
}

function appendEntities(containerID, objList, idText) {
    _.uniq(objList).forEach(function(item) {
        $(containerID).append(
            $(document.createElement('label')).text(item)
            .append(
                $(document.createElement('input')).attr({
                    id:    idText + item,
                    name:  idText + item,
                    value: idText + item,
                    class: 'entities-checkbox',
                    type:  'checkbox'
                })
            )  
        );
    })
}

function chart(data, color) {
  var format = d3.time.format("%Y-%m-%d");
  
  data.forEach(function(d) {
    d.date = format.parse(d.date);
    d.value = +d.value;
    d.key = d.key;
  });

  var datearray = [];
  var colorrange = [];

  if (color == "blue") {
    colorrange = ["#045A8D", "#2B8CBE", "#74A9CF", "#A6BDDB", "#D0D1E6", "#F1EEF6"];
  }
  else if (color == "pink") {
    colorrange = ["#980043", "#DD1C77", "#DF65B0", "#C994C7", "#D4B9DA", "#F1EEF6"];
  }
  else if (color == "orange") {
    colorrange = ["#B30000", "#E34A33", "#FC8D59", "#FDBB84", "#FDD49E", "#FEF0D9"];
  }
  strokecolor = colorrange[0];

  var margin = {top: 20, right: 40, bottom: 30, left: 30};
  var width = $("#timeline").width() - margin.left - margin.right;
  var height = 400 - margin.top - margin.bottom;

  var tooltip = d3.select("body")
      .append("div")
      .attr("class", "remove")
      .attr("id", "tooltip")
      .style("z-index", "20")
      .style("visibility", "hidden")

  var x = d3.time.scale()
      .range([0, width]);

  var y = d3.scale.linear()
      .range([height-10, 0]);

  var z = d3.scale.ordinal()
      .range(colorrange);

  var xAxis = d3.svg.axis()
      .scale(x)
      .orient("bottom")
      .tickFormat(d3.time.format("%d/%m/%y"))
      .ticks(d3.time.weeks, 1)
      .tickSize(10, 0);

  var stack = d3.layout.stack()
      .offset("silhouette")
      .values(function(d) { return d.values; })
      .x(function(d) { return d.date; })
      .y(function(d) { return d.value; });

  var nest = d3.nest()
      .key(function(d) { return d.key; });

  var area = d3.svg.area()
      .interpolate("cardinal")
      .x(function(d) { return x(d.date); })
      .y0(function(d) { return y(d.y0); })
      .y1(function(d) { return y(d.y0 + d.y); });

  var svg = d3.select(".chart").append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  // var yAxis = d3.svg.axis()
  //     .scale(y);

  // var yAxisr = d3.svg.axis()
  //     .scale(y);

  // svg.append("g")
  //   .attr("class", "y axis")
  //   .attr("transform", "translate(" + width + ", 0)")
  //   .call(yAxis.orient("right"));

  // svg.append("g")
  //   .attr("class", "y axis")
  //   .call(yAxis.orient("left"));


  var layers = stack(nest.entries(data));

  x.domain(d3.extent(data, function(d) { return d.date; }));
  y.domain([0, d3.max(data, function(d) { return d.y0 + d.y; })]);

  svg.selectAll(".layer")
    .data(layers)
    .enter().append("path")
    .attr("class", "layer")
    .attr("d", function(d) { return area(d.values); })
    .style("fill", function(d, i) { return z(i); });


  svg.append("g")
    .attr("class", "x-axis")
    .attr("transform", "translate(0," + height + ")")
    .call(xAxis);

  svg.selectAll(".tick text").each(function(d, i) {
    if (i%4 != 0){
      $(this).hide()
    }
  });

  svg.selectAll(".tick line").each(function(d, i) {
    if (i%2 != 0){
      $(this).attr("y2", "5")
    }
  });

  svg.selectAll(".layer")
    .attr("opacity", 1)
    .on("mouseover", function(d, i) {
      svg.selectAll(".layer").transition()
      .duration(250)
      .attr("opacity", function(d, j) {
        return j != i ? 0.6 : 1;
      })
    })
    .on("mousemove", function(d, i) {
      mouse = d3.mouse(this);
      mousex = mouse[0],
      mousey = mouse[1];
      var invertedx = x.invert(mousex);
      invertedx = invertedx.getMonth() + invertedx.getDate();
      var selected = (d.values);
      for (var k = 0; k < selected.length; k++) {
        datearray[k] = selected[k].date
        datearray[k] = datearray[k].getMonth() + datearray[k].getDate();
      }

      mousedate = datearray.indexOf(invertedx);
      pro = d.values[mousedate].value;

      d3.select(this)
        .classed("hover", true)
        .attr("stroke", strokecolor)
        .attr("stroke-width", "0.5px"); 

      tooltip.html( "<p>" + d.key + "<br>" + pro + "</p>" ).style("visibility", "visible")
      .style("left", ($("#timeline").offset().left + mousex) +"px")
      .style("top", ($("#timeline").offset().top + mousey - 100) +"px");
    })
    .on("mouseout", function(d, i) {
      svg.selectAll(".layer")
        .transition()
        .duration(250)
        .attr("opacity", "1");
      d3.select(this)
        .classed("hover", false)
        .attr("stroke-width", "0px"), tooltip.html( "<p>" + d.key + "<br>" + pro + "</p>" ).style("visibility", "hidden");
    })

  var vertical = d3.select(".chart")
      .append("div")
      .attr("class", "remove")
      .style("position", "absolute")
      .style("z-index", "19")
      .style("width", "1px")
      .style("height", "380px")
      .style("top", "10px")
      .style("bottom", "30px")
      .style("left", "0px")
      .style("background", "#fff");

  d3.select(".chart")
    .on("mousemove", function(){  
       mousex = d3.mouse(this);
       mousex = mousex[0] + 5;
       vertical.style("left", mousex + "px" )
     })
    .on("mouseover", function(){  
       mousex = d3.mouse(this);
       mousex = mousex[0] + 5;
       vertical.style("left", mousex + "px")
     });

}