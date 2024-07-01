export default function () {
  return pipeline($=>$
    .serveHTTP(new Message('hi'))
  )
}
