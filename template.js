(function(win, doc, undefined) {
  var eventHandlersId = 0
  var eventHandlers = win.__eventHandlers__ = {}
  // var tempDiv = doc.createElement('div')

  function getContent(str, preIndex) { // 用于解析字符串中第一个合法的双花括号位置和内容
    var flag = 0
    var start, end

    for (var i = 0; i < str.length; i++) {
      if (str[i] === '{' || str[i] === '}') {
        if (str[i] === '{') {
          if (str[i + 1] !== '{') // 如果不是连续两个花括号则不理会
            continue;
          else {
            flag++;
            start = typeof start === 'undefined' ? i : start
            i++
          }
        }
        if (str[i] === '}') {
          if (str[i + 1] !== '}')
            continue;
          else {
            flag--
            end = ++i
          }
        }
        if (flag === 0) {
          return {
            start: start + preIndex + 1,
            end: end + preIndex + 1,
            content: str.substring(start + 2, end - 1).trim()
          }
        }
        if (flag < 0) flag = 0 // 如果出现不合法的情况则重置flag
      }
    }
    return null
  }
  var getDirective = function(str) {
    var flag = 0
    var start, end

    for (var i = 0; i < str.length; i++) {
      if (str[i] === '(' || str[i] === ')') {
        if (str[i] === '(') {
          flag++;
          start = typeof start === 'undefined' ? i : start
        }
        if (str[i] === ')') {
          flag--
          end = i
        }
        if (flag === 0) {
          return {
            content: str.substr(end + 1).trim(),
            key: str.substring(start + 1, end).trim()
          }
        }
        // if (flag < 0) flag = 0
      }
    }
    return null
  }


  function calcValue(expression, data) {
    var values = []
    for(var key in data) {
      if(data.hasOwnProperty(key)) {
        values.push(data[key])
      }
    }
    try {
      var func = Function.apply(null, Object.keys(data).concat('return ' + expression))
      return func.apply(null, values)
    } catch (e) {
      console.error('Error at ' + expression + '\n', e)
      return expression
    }
  }

  function getValue(key, data) {
    var path = key.split('.')
    var currentValue = data
    path.forEach(function(key) {
      var preKeyIndex = key.indexOf('[')
      if (preKeyIndex > -1) {
        currentValue = currentValue[key.substr(0, preKeyIndex)]
        key.replace(/\[(.+?)\]/g, function(target, group) {
          currentValue = currentValue[group.trim()]
        })
      } else {
        currentValue = currentValue[key]
      }
    })
    return currentValue
  }


  function compile(keys, data, options) {
    var eventHandler;
    if (keys[0] === '@') {
      eventHandler = calcValue(keys.substr(1), data).bind(data)
      eventHandlersId++
      options.newlyEventHandlersIds.push(eventHandlersId)
      eventHandlers[eventHandlersId] = eventHandler
      return '__eventHandlers__[' + eventHandlersId + '](event)'
    }
    if (keys[0] === '!') {
      return keys.substr(1).trim()
    }

    var partial
    if (keys[0] === '#') {
      partial = options.partials[keys.substr(1).trim()]
      if (!partial) return keys
      return template(partial, data, options)
    }

    var parseDirective = function(directiveName, keys) {
      var reg = new RegExp('^' + directiveName + '\\s*\\(.*?\\)')
      if (reg.test(keys)) {
        return getDirective(keys.substr(directiveName.length))
      }
    }
    var directive
    if (directive = parseDirective('if', keys)) {
      return calcValue(directive.key, data) ?
        template(directive.content, data, options) : ''
    }
    if (directive = parseDirective('for', keys)) {
      return calcValue(directive.key, data).map(function(v, i) {
        return template(directive.content, Object.assign({}, data, {
          $value: v,
          $index: i
        }), options)
      }).join('')
    }

    if (directive = parseDirective('with', keys)) {
      return template(directive.content, calcValue(directive.key, data), options)
    }

    if (directive = parseDirective('var', keys)) {
      options.partials[directive.key] = directive.content
      return ''
    }

    var funcNames = Object.keys(options.funcs),
      funcName
    for (var i = 0; i < funcNames.length; i++) {
      funcName = funcNames[i]
      directive = parseDirective(funcName, keys)
      if (directive && typeof options.funcs[funcName] === 'function') {
        return options.funcs[funcName].apply(data,
          calcValue('[' + directive.key + ']', data).concat(directive.content))
      }
    }

    return calcValue(keys, data)
  }

  function template(str, data, options) {
    var value = {
      end: -1
    };
    var preEnd = -1;
    var restStr = str
    var result = []
    var start = 0
    while (value) {
      preEnd = value.end;
      value = getContent(restStr, preEnd)
      if (value) {
        restStr = restStr.substr(value.end - preEnd)
        result.push(str.substring(start, value.start))
        result.push(compile(value.content, data, options))
        start = value.end + 1
      } else {
        result.push(str.substr(start))
      }
    }
    return result.join('')
  }

  function render(dom, templateStr, data, options) {
    var _options = Object.assign({
      partials: {},
      funcs: {}
    }, options, {
      newlyEventHandlersIds: []
    })
    delete _options.funcs['if']
    delete _options.funcs['for']
    delete _options.funcs['with']
    delete _options.funcs['var']
    var timer
    var newDataList = []
    var callbacks = []
    data.render = function(newData, callback) {
      if(newData && typeof newData === 'object') {
        newDataList.push(newData)
        if(typeof callback === 'function') {
          callbacks.push(callback)
        }
      } else if(typeof newData === 'function') {
        callbacks.push(newData)
      }
      clearTimeout(timer)
      timer = setTimeout(function() {
        _options.newlyEventHandlersIds.forEach(function(handlerKey) {
          delete eventHandlers[handlerKey]
        })
        _options.newlyEventHandlersIds = []
        dom.innerHTML = template(
          templateStr,
          Object.assign.apply(Object, [data].concat(newDataList)),
          _options
        )
        callbacks.forEach(function(func) {
          func.call(data, dom)
        })
        newDataList = []
        callbacks = []
      })
    }
    data.refs = function(refName) {
      var doms = dom.getElementsByTagName('*')
      for (var i = 0; i < doms.length; i++) {
        if (doms[i].getAttribute('ref') === refName) {
          return doms[i]
        }
      }
    }
    dom.innerHTML = template(templateStr, data, _options)
  }
  win.render = render
})(window, document)

