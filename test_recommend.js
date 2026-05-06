fetch('http://localhost:5000/api/recommend', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    skinTone: 'warm',
    bodyShape: 'rectangle',
    gender: 'female',
    usage: 'Casual'
  })
})
.then(res => res.json())
.then(data => console.log(JSON.stringify(data, null, 2)))
.catch(err => console.error(err));
