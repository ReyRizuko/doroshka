package app.dorozhka.music.core.data

import kotlinx.serialization.Serializable
import retrofit2.http.GET
import retrofit2.http.Path

@Serializable
data class StreamResolutionResponse(
    val url: String,
    val downloadAllowed: Boolean = false
)

interface CoreStreamApi {
    @GET("api/v1/tracks/{id}/stream")
    suspend fun resolveStream(@Path("id") trackId: String): StreamResolutionResponse
}
