/**
 * Catálogo de tecnologías. Es la fuente única de los tres sitios donde se usa
 * cada una: la parrilla de la sección, el color de acento que tiñe la página
 * al seleccionarla y el código que aparece en la pantalla del portátil.
 */
export interface Tech {
  /** No se traduce: "Java" es "Java" en todos los idiomas. */
  name: string;
  /** Clave bajo tech.notes.* en los JSON de i18n. */
  key: string;
  /** Color de marca. Se corrige automáticamente si no contrasta con el fondo. */
  color: number;
  /** Se pinta en la pantalla del MacBook al seleccionarla. */
  code: string;
}

export const TECHNOLOGIES: readonly Tech[] = [
  {
    name: 'Java',
    key: 'java',
    color: 0xf89820,
    code: `public record Order(Long id, String table, List<Item> items) {

  public BigDecimal total() {
    return items.stream()
        .map(Item::price)
        .reduce(BigDecimal.ZERO, BigDecimal::add);
  }
}`,
  },
  {
    name: 'Spring Boot',
    key: 'spring',
    color: 0x6db33f,
    code: `@RestController
@RequestMapping("/api/orders")
class OrderController {

  @PostMapping
  ResponseEntity<Order> create(@Valid @RequestBody NewOrder body) {
    return ResponseEntity.status(CREATED).body(service.place(body));
  }
}`,
  },
  {
    name: 'C#',
    key: 'csharp',
    color: 0x9b4f96,
    code: `public sealed record Trade(int From, int To, string ItemId);

public async Task<Result> ExecuteAsync(Trade trade, CancellationToken ct)
{
    var seller = await _players.FindAsync(trade.From, ct);
    return seller.Has(trade.ItemId)
        ? await _ledger.TransferAsync(trade, ct)
        : Result.Fail("item not owned");
}`,
  },
  {
    name: '.NET',
    key: 'dotnet',
    color: 0x512bd4,
    code: `var builder = WebApplication.CreateBuilder(args);

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme);
builder.Services.AddScoped<ITradeService, TradeService>();

var app = builder.Build();
app.MapControllers();
app.Run();`,
  },
  {
    name: 'ASP.NET Core',
    key: 'aspnet',
    color: 0x5c2d91,
    code: `app.MapGet("/api/items/{id:int}", async (int id, IItemStore store) =>
    await store.FindAsync(id) is { } item
        ? Results.Ok(item)
        : Results.NotFound())
   .RequireAuthorization()
   .WithName("GetItem");`,
  },
  {
    name: 'Angular',
    key: 'angular',
    color: 0xdd0031,
    code: `@Component({
  selector: 'app-projects',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsComponent {
  readonly activeIndex = signal(0);
}`,
  },
  {
    name: 'Vue',
    key: 'vue',
    color: 0x41b883,
    code: `<script setup lang="ts">
const trips = ref<Trip[]>([])
const cheapest = computed(() =>
  [...trips.value].sort((a, b) => a.price - b.price)[0]
)

onMounted(async () => { trips.value = await search() })
</script>`,
  },
  {
    name: 'JavaScript',
    key: 'javascript',
    color: 0xf7df1e,
    code: `const groupBy = (rows, key) =>
  rows.reduce((acc, row) => {
    (acc[row[key]] ??= []).push(row)
    return acc
  }, {})

export const byTable = (orders) => groupBy(orders, 'table')`,
  },
  {
    name: 'TypeScript',
    key: 'typescript',
    color: 0x3178c6,
    code: `type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string }

export function unwrap<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(r.error)
  return r.value
}`,
  },
  {
    name: 'SQL',
    key: 'sql',
    color: 0x00758f,
    code: `SELECT t.name AS mesa,
       COUNT(o.id) AS pedidos,
       SUM(o.total) AS facturado
  FROM orders o
  JOIN tables t ON t.id = o.table_id
 WHERE o.created_at >= NOW() - INTERVAL '7 days'
 GROUP BY t.name
 ORDER BY facturado DESC;`,
  },
  {
    name: 'REST API',
    key: 'rest',
    color: 0x4a9dd6,
    code: `POST /api/orders HTTP/1.1
Authorization: Bearer <jwt>
Content-Type: application/json

{ "table": "12", "items": [{ "sku": "CF-01", "qty": 2 }] }

201 Created
Location: /api/orders/8842`,
  },
  {
    name: 'Git',
    key: 'git',
    color: 0xf05033,
    code: `$ git switch -c feat/orders-realtime
$ git add src/main/java/com/mesero/orders
$ git commit -m "feat: push order updates over websocket"
$ git rebase -i origin/main
$ git push -u origin feat/orders-realtime`,
  },
  {
    name: 'Postman',
    key: 'postman',
    color: 0xff6c37,
    code: `pm.test("crea el pedido y devuelve id", () => {
    pm.response.to.have.status(201);
    const body = pm.response.json();
    pm.expect(body.id).to.be.a("number");
    pm.environment.set("orderId", body.id);
});`,
  },
  {
    name: 'Docker',
    key: 'docker',
    color: 0x2496ed,
    code: `FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY target/mesero.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]`,
  },
];

/** Lo que se ve en la pantalla mientras no hay ninguna tecnología elegida. */
export const DEFAULT_CODE = `@SpringBootApplication
public class MeseroApplication {

  public static void main(String[] args) {
    SpringApplication.run(MeseroApplication.class, args);
  }
}`;
